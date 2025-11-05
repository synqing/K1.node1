import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useInfiniteTracks, useMetrics, useArtifacts, useActivityLog, useTelemetryStream } from '@backend/react-query-hooks';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { type ConnectionState } from '../../lib/types';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Toolbar } from '../analysis/Toolbar';
import { UploadModal } from '../analysis/UploadModal';
import { TrackListItem } from '../analysis/TrackListItem';
import { BeatGridChart } from '../analysis/BeatGridChart';
import { FrequencyChart } from '../analysis/FrequencyChart';
import { DynamicsChart } from '../analysis/DynamicsChart';
import { SectionsTimeline } from '../analysis/SectionsTimeline';
import { GraphPresetCard } from '../analysis/GraphPresetCard';
import { ArtifactTable, type ArtifactRow } from '../analysis/ArtifactTable';
import { ActivityLog, type ActivityLogItem } from '../analysis/ActivityLog';
import { DeploySideSheet } from '../analysis/DeploySideSheet';
import { MetricsCard as MetricsCardComponent } from '../analysis/MetricsCard';
import { RecommendationPanel } from '../analysis/RecommendationPanel';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAnalysisRecommendations } from '../../hooks/useAnalysisRecommendations';
import { useApplyRecommendations } from '../../hooks/useApplyRecommendations';
import { postParams, getParams, type FirmwareParams } from '../../lib/api';

interface AnalysisViewProps {
  connectionState?: ConnectionState;
}

export function AnalysisView({ connectionState }: AnalysisViewProps) {
	const [uploadOpen, setUploadOpen] = useState(false);
	const [deployOpen, setDeployOpen] = useState(false);
	const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
	const [activityPinned, setActivityPinned] = useState(false);
	const [isMobile, setIsMobile] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [dismissedRecommendations, setDismissedRecommendations] = useState<Set<string>>(new Set());
  const [currentDeviceParams, setCurrentDeviceParams] = useState<Partial<FirmwareParams> | null>(null);
  const listParentRef = useRef<HTMLDivElement>(null);

  // Backend integration for applying recommendations
  const { mutate: applyRecommendationsBackend, isPending: isApplyingBackend } = useApplyRecommendations();
  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteTracks({ search: search || undefined, status: status as any, limit: 20 });

  const uiTracks = useMemo(() => {
    return infiniteData?.pages.flatMap((p) => p.items) ?? [];
  }, [infiniteData]);

	useEffect(() => {
		const handler = () => setIsMobile(window.innerWidth < 768);
		handler();
		window.addEventListener('resize', handler);
		return () => window.removeEventListener('resize', handler);
	}, []);

	useEffect(() => {
		if (!uiTracks.length) {
			setSelectedTrackId(null);
			return;
		}

		setSelectedTrackId((current) => {
			if (current && uiTracks.some((track) => track.id === current)) {
				return current;
			}
			return uiTracks[0]?.id ?? null;
		});
	}, [uiTracks]);

  // Mock artefacts and storage usage
  const { data: artifacts = [], isLoading: artifactsLoading } = useArtifacts();
  const artifactRows: ArtifactRow[] = useMemo(() => {
    return artifacts.map((a, idx) => ({
      id: String(idx),
      type: a.type,
      sizeBytes: undefined,
      status: a.status,
      sha256: a.sha,
      downloadUrl: undefined,
      createdAt: a.age,
      displayName: a.name,
    }));
  }, [artifacts]);

  const storageUsagePercent = 62;
  

	// Build basic activity items from jobs, with safe fallbacks
  const { data: activity = [] } = useActivityLog();
  const activityItems: ActivityLogItem[] = useMemo(() =>
    activity.map((a, idx) => ({ id: String(idx), message: a.message, severity: a.severity, timestamp: a.timestamp })),
  [activity]);

  const uiSelectedTrack = useMemo(() => {
    if (selectedTrackId) return uiTracks.find((track) => track.id === selectedTrackId);
    return uiTracks[0];
  }, [selectedTrackId, uiTracks]);

  // Live telemetry stream for selected track
  const { connected: telemetryConnected, events: telemetryEvents } = useTelemetryStream(uiSelectedTrack?.id ?? null);

  // Recommendations for selected track
  const { data: recommendations } = useAnalysisRecommendations(uiSelectedTrack?.id);

  // Fetch current device parameters if connected
  useEffect(() => {
    const fetchDeviceParams = async () => {
      if (connectionState?.connected && connectionState.deviceIp) {
        try {
          const params = await getParams(connectionState.deviceIp);
          setCurrentDeviceParams(params);
        } catch (error) {
          console.error('Failed to fetch device parameters:', error);
          setCurrentDeviceParams(null);
        }
      } else {
        setCurrentDeviceParams(null);
      }
    };

    fetchDeviceParams();
  }, [connectionState?.connected, connectionState?.deviceIp]);

  // Handle applying recommendations to device (from panel)
  const handleApplyRecommendationsFromParams = async (params: Partial<FirmwareParams>) => {
    if (!connectionState?.connected || !connectionState.deviceIp) {
      toast.error('Device not connected');
      return;
    }

    try {
      const result = await postParams(connectionState.deviceIp, params);
      if (result.ok) {
        toast.success('Recommendations applied successfully!');
        // Update current device params
        if (result.data) {
          setCurrentDeviceParams(result.data);
        }
      } else {
        toast.warning('Recommendations sent but confirmation pending');
      }
    } catch (error: any) {
      console.error('Failed to apply recommendations:', error);
      toast.error(`Failed to apply recommendations: ${error.message}`);
    }
  };

  // Handle dismissing recommendations
  const handleDismissRecommendations = (trackId: string) => {
    setDismissedRecommendations(prev => new Set(prev).add(trackId));
    // Persist dismissal in localStorage
    localStorage.setItem(`dismissed-recommendations-${trackId}`, 'true');
  };

  // Check if recommendations are dismissed
  const isRecommendationDismissed = (trackId: string) => {
    return dismissedRecommendations.has(trackId) || 
           localStorage.getItem(`dismissed-recommendations-${trackId}`) === 'true';
  };

  // Virtualizer
  const rowVirtualizer = useVirtualizer({
    count: uiTracks.length,
    getScrollElement: () => listParentRef.current,
    estimateSize: () => 72,
    overscan: 6,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    const last = virtualItems[virtualItems.length - 1];
    if (last && last.index >= uiTracks.length - 5) {
      fetchNextPage();
    }
  }, [virtualItems, hasNextPage, isFetchingNextPage, uiTracks.length, fetchNextPage]);

  const { data: metrics = [] } = useMetrics();

  // Backend variant: Apply recommendations via API endpoint
  const handleApplyRecommendationsBackend = async (params: Partial<FirmwareParams>) => {
    if (!connectionState?.connected || !connectionState.deviceIp) {
      toast.error('Device not connected');
      return;
    }

    // Generate synthetic device_id from IP (in production, this would come from device discovery)
    const deviceId = `device_${connectionState.deviceIp.replace(/\./g, '_')}`;

    try {
      applyRecommendationsBackend(
        { deviceId, params },
        {
          onSuccess: (response) => {
            toast.success(`Recommendations applied! Applied ${Object.keys(response.applied_params).length} parameters`);
            // Update local device params state with applied values
            const updatedParams = { ...currentDeviceParams, ...response.applied_params };
            setCurrentDeviceParams(updatedParams);
          },
          onError: (error) => {
            toast.error(`Failed to apply recommendations: ${error.message}`);
          },
        }
      );
    } catch (error: any) {
      console.error('Error applying recommendations:', error);
      toast.error(`Unexpected error: ${error.message}`);
    }
  };

  return (
    <ErrorBoundary>
    <div
      className="flex h-full flex-col"
      style={{ backgroundColor: 'var(--color-prism-bg-canvas)' }}
    >
      <Toolbar
        onUploadClick={() => setUploadOpen(true)}
        onAnalyseClick={() => console.log('Analyse track')}
        onDeployClick={() => setDeployOpen(true)}
        onApplyRecommendationsClick={() => console.log('Apply recommendations via panel')}
        isDeviceConnected={!!connectionState?.connected}
      />

      <div className="flex flex-1 overflow-hidden">
        {!isMobile && (
          <aside
            className="w-80 border-r"
            style={{
              backgroundColor: 'var(--color-prism-bg-surface)',
              borderColor: 'var(--color-border)',
            }}
          >
            <div className="border-b px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
              <h3
                className="font-['Bebas_Neue',sans-serif] uppercase tracking-wide"
                style={{ color: 'var(--color-prism-text-primary)' }}
              >
                Track Library
              </h3>
              <p className="text-sm" style={{ color: 'var(--color-prism-text-secondary)' }}>
                {connectionState?.connected
                  ? `${uiTracks.length} tracks · connected to ${connectionState.deviceIp}`
                  : `${uiTracks.length} tracks`}
              </p>
            </div>
            <div className="space-y-3 p-3">
              <div className="space-y-2">
                <Label className="text-xs" style={{ color: 'var(--color-prism-text-secondary)' }}>Search</Label>
                <Input
                  placeholder="Search tracks..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full"
                  style={{
                    backgroundColor: 'var(--color-prism-bg-canvas)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-prism-text-primary)',
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs" style={{ color: 'var(--color-prism-text-secondary)' }}>Status</Label>
                <Select value={status ?? 'all'} onValueChange={(v) => setStatus(v === 'all' ? undefined : v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="ready">Ready</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div ref={listParentRef} className="h-[calc(100vh-280px)] overflow-auto">
                <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
                  {rowVirtualizer.getVirtualItems().map((vi) => {
                    const track = uiTracks[vi.index];
                    return (
                      <div
                        key={vi.key}
                        data-index={vi.index}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${vi.start}px)`,
                        }}
                      >
                        {track ? (
                          <TrackListItem
                            id={track.id}
                            title={track.title}
                            artist={track.artist}
                            duration={track.duration}
                            bpm={track.bpm}
                            fMeasure={track.fMeasure}
                            status={track.status}
                            selected={track.id === selectedTrackId}
                            onSelect={() => setSelectedTrackId(track.id)}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                {hasNextPage && (
                  <div className="py-2 text-center text-xs" style={{ color: 'var(--color-prism-text-secondary)' }}>
                    {isFetchingNextPage ? 'Loading more…' : ''}
                  </div>
                )}
              </div>
            </div>
          </aside>
        )}

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6">
            <Card
              className="border p-4"
              style={{
                backgroundColor: 'var(--color-prism-bg-surface)',
                borderColor: 'var(--color-border)',
              }}
            >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                  <h2
                    className="text-2xl font-semibold"
                    style={{ color: 'var(--color-prism-text-primary)' }}
                  >
                    {uiSelectedTrack?.title ?? '—'}
                  </h2>
                  <p className="text-sm" style={{ color: 'var(--color-prism-text-secondary)' }}>
                    {uiSelectedTrack?.artist ?? '—'} · {uiSelectedTrack?.duration ?? '—'} ·
                    {uiSelectedTrack?.bpm ? ` ${uiSelectedTrack?.bpm} BPM` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone="positive">Bundle ready</StatusBadge>
                  <StatusBadge tone="neutral">Runtime 7.3 ms</StatusBadge>
                  <StatusBadge tone="warning">Firmware ≥ 2.5.0</StatusBadge>
                  <StatusBadge tone={telemetryConnected ? 'positive' : 'warning'}>
                    Telemetry {telemetryConnected ? 'connected' : 'disconnected'}
                  </StatusBadge>
                  <Button
                    variant="secondary"
                    disabled={!connectionState?.connected}
                    onClick={() => toast.info('Use the Recommendations panel to apply analysis results')}
                  >
                    Apply Analysis Results
                  </Button>
                </div>
              </div>
            </Card>

            {/* Recommendations Panel */}
            {uiSelectedTrack &&
             recommendations &&
             !isRecommendationDismissed(uiSelectedTrack.id) && (
              <RecommendationPanel
                trackId={uiSelectedTrack.id}
                recommendations={recommendations}
                currentParams={currentDeviceParams}
                onApply={handleApplyRecommendationsBackend}
                isApplying={isApplyingBackend}
                onDismiss={() => handleDismissRecommendations(uiSelectedTrack.id)}
              />
            )}

            <section className="grid gap-4 md:grid-cols-3">
              {metrics.map((metric) => (
                <MetricsCardComponent
                  key={metric.label}
                  title={metric.label}
                  value={metric.value}
                  delta={metric.delta}
                  tone={metric.tone}
                />
              ))}
            </section>

            {/* Telemetry panel */}
            <Card
              className="border p-4"
              style={{
                backgroundColor: 'var(--color-prism-bg-surface)',
                borderColor: 'var(--color-border)',
              }}
            >
              <div className="flex items-center justify-between">
                <h3
                  className="text-lg font-semibold"
                  style={{ color: 'var(--color-prism-text-primary)' }}
                >
                  Live Telemetry
                </h3>
                <span className="text-xs" style={{ color: 'var(--color-prism-text-secondary)' }}>
                  {telemetryConnected ? 'streaming' : 'offline'} · {telemetryEvents.length} events
                </span>
              </div>
              <div className="mt-3 max-h-40 overflow-auto rounded border p-2 text-xs" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-prism-bg-canvas)', color: 'var(--color-prism-text-secondary)' }}>
                {telemetryEvents.length === 0 ? (
                  <div>Waiting for telemetry…</div>
                ) : (
                  telemetryEvents.slice(-20).map((e) => (
                    <div key={e.seq} className="flex justify-between">
                      <span>#{e.seq} {e.type}</span>
                      <span>{e.message ?? ''}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <section className="grid gap-4 md:grid-cols-2">
              <BeatGridChart />
              <FrequencyChart />
              <DynamicsChart />
              <SectionsTimeline />
            </section>

            <GraphPresetCard />

            <ArtifactTable
              artifacts={artifactRows}
              storageUsagePercent={storageUsagePercent}
              isLoading={artifactsLoading}
              onCopyLink={(artifactId, url) => {
                if (url) {
                  navigator.clipboard.writeText(url).then(
                    () => toast.success('Copied download link'),
                    () => toast.error('Failed to copy link'),
                  );
                } else {
                  toast.error('No download URL available');
                }
              }}
              onOpenLink={(artifactId, url) => {
                if (url) {
                  window.open(url, '_blank');
                } else {
                  toast.error('No download URL available');
                }
              }}
            />
          </div>
        </main>
      </div>

      <ActivityLog items={activityItems} pinned={activityPinned} onTogglePin={() => setActivityPinned((p) => !p)} />

      <UploadModal open={uploadOpen} onOpenChange={setUploadOpen} />
      <DeploySideSheet
        open={deployOpen}
        onOpenChange={setDeployOpen}
        connectionState={connectionState}
      />

    </div>
    </ErrorBoundary>
  );
}

interface StatusBadgeProps {
  children: ReactNode;
  tone?: 'positive' | 'neutral' | 'warning';
}

function StatusBadge({ children, tone = 'neutral' }: StatusBadgeProps) {
  const toneColor =
    tone === 'positive'
      ? 'var(--color-prism-success)'
      : tone === 'warning'
        ? 'var(--color-prism-warning)'
        : 'var(--color-prism-info)';

  return (
    <span
      className="rounded-full px-3 py-1 text-xs font-medium"
      style={{
        backgroundColor: 'rgba(255,255,255,0.05)',
        border: '1px solid ' + toneColor,
        color: toneColor,
      }}
    >
      {children}
    </span>
  );
}
