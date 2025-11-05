import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '../ui/table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';

export type ArtifactStatus = 'active' | 'missing' | 'soft-deleted';

export interface ArtifactRow {
	id: string;
	type: string;
	sizeBytes?: number;
	status?: ArtifactStatus;
	sha256?: string;
	downloadUrl?: string;
	createdAt?: string;
	displayName?: string;
}

interface ArtifactTableProps {
	artifacts: ArtifactRow[];
	storageUsagePercent?: number;
	isLoading?: boolean;
	onCopyLink?: (artifactId: string, url?: string) => void;
	onOpenLink?: (artifactId: string, url?: string) => void;
}

export function ArtifactTable({
	artifacts,
	storageUsagePercent,
	isLoading,
	onCopyLink,
	onOpenLink,
}: ArtifactTableProps) {
	const usage = Number.isFinite(storageUsagePercent ?? NaN)
		? Math.max(0, Math.min(100, storageUsagePercent ?? 0))
		: undefined;

	return (
		<div
			className="rounded-lg border"
			style={{
				backgroundColor: 'var(--color-prism-bg-surface)',
				borderColor: 'var(--color-border)',
			}}
		>
			<div className="flex items-center justify-between px-4 py-3">
				<h4
					className="font-['Bebas_Neue',sans-serif] uppercase tracking-wide"
					style={{ color: 'var(--color-prism-text-primary)' }}
				>
					Artefacts
				</h4>
				<div className="flex items-center gap-2 text-xs">
					<span style={{ color: 'var(--color-prism-text-secondary)' }}>
						Storage used
					</span>
					<div className="h-2 w-28 overflow-hidden rounded-full bg-[var(--color-prism-bg-canvas)]">
						<div
							className="h-full transition-all"
							style={{
								width: usage !== undefined ? `${usage}%` : '0%',
								background: 'var(--color-prism-warning)',
							}}
						/>
					</div>
					<span
						className="text-xs"
						style={{ color: 'var(--color-prism-warning)' }}
					>
						{usage !== undefined ? `${usage.toFixed(0)}%` : '—'}
					</span>
				</div>
			</div>

			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead>Type</TableHead>
						<TableHead>Size</TableHead>
						<TableHead>Created</TableHead>
						<TableHead>SHA</TableHead>
						<TableHead className="text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{isLoading ? (
						<TableRow>
							<TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
								Loading artefacts…
							</TableCell>
						</TableRow>
					) : !artifacts.length ? (
						<TableRow>
							<TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
								No artefacts available for this version.
							</TableCell>
						</TableRow>
					) : (
						artifacts.map((artifact) => (
							<TableRow key={artifact.id}>
								<TableCell className="font-mono text-xs text-[var(--color-prism-text-primary)]">
									{artifact.displayName ?? artifact.id}
								</TableCell>
								<TableCell>
									<Badge variant="outline" className="text-xs">
										{artifact.type}
									</Badge>
								</TableCell>
								<TableCell>{formatBytes(artifact.sizeBytes)}</TableCell>
								<TableCell>{formatTimestamp(artifact.createdAt)}</TableCell>
								<TableCell className="font-mono text-xs text-muted-foreground">
									{artifact.sha256?.slice(0, 8) ?? '—'}
								</TableCell>
								<TableCell className="space-x-2 text-right">
									<Button
										size="sm"
										variant="ghost"
										disabled={!artifact.downloadUrl}
										onClick={() => onCopyLink?.(artifact.id, artifact.downloadUrl)}
									>
										Copy
									</Button>
									<Button
										size="sm"
										variant="ghost"
										disabled={!artifact.downloadUrl}
										onClick={() => onOpenLink?.(artifact.id, artifact.downloadUrl)}
									>
										Download
									</Button>
									<StatusBadge status={artifact.status ?? 'active'} />
								</TableCell>
							</TableRow>
						))
					)}
				</TableBody>
			</Table>
		</div>
	);
}

interface StatusBadgeProps {
	status: ArtifactStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
	if (status === 'active') {
		return null;
	}
	const tone =
		status === 'soft-deleted'
			? 'var(--color-prism-warning)'
			: 'var(--color-prism-info)';

	return (
		<Badge
			variant="outline"
			className={cn('text-xs', status === 'soft-deleted' && 'font-medium')}
			style={{
				borderColor: tone,
				color: tone,
			}}
		>
			{status === 'soft-deleted' ? 'Soft deleted' : 'Missing'}
		</Badge>
	);
}

function formatBytes(size?: number) {
	if (!size || Number.isNaN(size)) return '—';
	if (size < 1024) return `${size} B`;
	const kb = size / 1024;
	if (kb < 1024) return `${kb.toFixed(1)} KB`;
	const mb = kb / 1024;
	if (mb < 1024) return `${mb.toFixed(1)} MB`;
	const gb = mb / 1024;
	return `${gb.toFixed(1)} GB`;
}

function formatTimestamp(timestamp?: string) {
	if (!timestamp) return '—';
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) return '—';
	return date.toLocaleString();
}
