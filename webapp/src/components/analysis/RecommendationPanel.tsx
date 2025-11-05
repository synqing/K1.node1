import { useState } from 'react';
import { Sparkles, X, ArrowRight, Info } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { DeviceRecommendation } from '../../hooks/useAnalysisRecommendations';
import { FirmwareParams } from '../../lib/api';

interface RecommendationPanelProps {
  trackId: string;
  recommendations: DeviceRecommendation;
  currentParams?: Partial<FirmwareParams>;
  onApply: (params: Partial<FirmwareParams>) => Promise<void>;
  isApplying?: boolean;
  onDismiss: () => void;
}

export function RecommendationPanel({
  trackId,
  recommendations,
  currentParams,
  onApply,
  isApplying: isApplyingProp,
  onDismiss,
}: RecommendationPanelProps) {
  const [isApplying, setIsApplying] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Use prop if provided (backend integration), otherwise use local state
  const isApplyingState = isApplyingProp !== undefined ? isApplyingProp : isApplying;

  const handleApply = async () => {
    setIsApplying(true);
    try {
      // Convert recommendations to firmware parameters
      const params: Partial<FirmwareParams> = {
        brightness: recommendations.recommendations.brightness.value,
        saturation: recommendations.recommendations.saturation.value,
        speed: recommendations.recommendations.speed.value,
        palette_id: recommendations.recommendations.palette_id.value,
      };

      await onApply(params);
      onDismiss();
    } catch (error) {
      console.error('Failed to apply recommendations:', error);
    } finally {
      setIsApplying(false);
    }
  };

  // Calculate average confidence
  const avgConfidence = Object.values(recommendations.recommendations)
    .reduce((sum, rec) => sum + rec.confidence, 0) / Object.keys(recommendations.recommendations).length;

  const formatValue = (key: string, value: any): string => {
    if (key === 'effect') return value;
    if (key === 'palette_id') return `Palette ${value}`;
    return `${Math.round(value * 100)}%`;
  };

  const getCurrentValue = (key: string): string => {
    if (!currentParams) return 'Unknown';
    
    switch (key) {
      case 'brightness':
        return currentParams.brightness ? `${Math.round(currentParams.brightness * 100)}%` : 'Unknown';
      case 'saturation':
        return currentParams.saturation ? `${Math.round(currentParams.saturation * 100)}%` : 'Unknown';
      case 'speed':
        return currentParams.speed ? `${Math.round(currentParams.speed * 100)}%` : 'Unknown';
      case 'palette_id':
        return currentParams.palette_id ? `Palette ${currentParams.palette_id}` : 'Unknown';
      case 'effect':
        return 'Current Pattern'; // Effect is pattern selection, not a parameter
      default:
        return 'Unknown';
    }
  };

  return (
    <Card className="border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20 p-4 my-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-blue-900 dark:text-blue-100">
            Recommended Settings for This Song
          </h3>
          <Badge variant="secondary" className="text-xs">
            {Math.round(avgConfidence * 100)}% confidence
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="text-blue-500 hover:text-blue-700 h-6 w-6 p-0"
          aria-label="Dismiss recommendation"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Analysis metadata */}
      <div className="mb-4 text-sm text-blue-700 dark:text-blue-300">
        <p>
          Based on: {recommendations.analysis_metadata.bpm} BPM, 
          {recommendations.analysis_metadata.beat_count} beats detected, 
          {Math.round(recommendations.analysis_metadata.energy_level * 100)}% energy level
        </p>
      </div>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="space-y-2">
          <h4 className="font-medium text-gray-700 dark:text-gray-300 text-sm">
            Your Current Settings
          </h4>
          <div className="space-y-1 text-sm">
            {Object.entries(recommendations.recommendations).map(([key, rec]) => (
              <div key={key} className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400 capitalize">
                  {key.replace('_', ' ')}:
                </span>
                <span className="font-mono text-gray-800 dark:text-gray-200">
                  {getCurrentValue(key)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium text-blue-700 dark:text-blue-300 text-sm">
            Recommended Settings
          </h4>
          <div className="space-y-1 text-sm">
            {Object.entries(recommendations.recommendations).map(([key, rec]) => (
              <div key={key} className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400 capitalize">
                  {key.replace('_', ' ')}:
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-blue-800 dark:text-blue-200">
                    {formatValue(key, rec.value)}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({Math.round(rec.confidence * 100)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Details toggle */}
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDetails(!showDetails)}
          className="text-blue-600 hover:text-blue-800 p-0 h-auto"
        >
          <Info className="w-4 h-4 mr-1" />
          {showDetails ? 'Hide' : 'Show'} Analysis Details
        </Button>
        
        {showDetails && (
          <div className="mt-2 p-3 bg-blue-100/50 dark:bg-blue-900/20 rounded text-xs space-y-1">
            <p><strong>Dominant Frequency:</strong> {Math.round(recommendations.analysis_metadata.dominant_frequency)} Hz</p>
            <p><strong>Track Duration:</strong> {Math.round(recommendations.analysis_metadata.duration_ms / 1000)}s</p>
            <p><strong>Energy Analysis:</strong> {recommendations.analysis_metadata.energy_level > 0.7 ? 'High energy detected' : recommendations.analysis_metadata.energy_level > 0.4 ? 'Medium energy detected' : 'Calm sections detected'}</p>
            <p><strong>Generated:</strong> {new Date(recommendations.timestamp).toLocaleString()}</p>
            <p><strong>Expires:</strong> {new Date(recommendations.expiresAt).toLocaleString()}</p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleApply}
          disabled={isApplyingState}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isApplyingState ? (
            'Applying...'
          ) : (
            <>
              <ArrowRight className="w-4 h-4 mr-2" />
              Apply Recommended Settings
            </>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={onDismiss}
          className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          Keep My Current Settings
        </Button>
      </div>

      {!currentParams && (
        <div className="mt-3 p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded text-sm text-yellow-800 dark:text-yellow-200">
          <Info className="w-4 h-4 inline mr-1" />
          Device state unknown. Recommendations will be applied anyway.
        </div>
      )}
    </Card>
  );
}