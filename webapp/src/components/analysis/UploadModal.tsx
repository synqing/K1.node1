import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { useState } from 'react';

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadModal({ open, onOpenChange }: UploadModalProps) {
  const [fileName, setFileName] = useState<string>('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        style={{
          backgroundColor: 'var(--color-prism-bg-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <DialogHeader>
          <DialogTitle
            className="font-['Bebas_Neue',sans-serif] uppercase tracking-wide"
            style={{ color: 'var(--color-prism-text-primary)' }}
          >
            Upload audio for analysis
          </DialogTitle>
          <DialogDescription style={{ color: 'var(--color-prism-text-secondary)' }}>
            MP3/WAV up to 50 MB. Estimated processing time ~45s per track.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed text-sm"
            style={{
              backgroundColor: 'var(--color-prism-bg-elevated)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-prism-text-secondary)',
            }}
          >
            <p>Drag & drop audio file</p>
            <p className="text-xs">or click to browse</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="title">Track title</Label>
            <Input id="title" placeholder="Midnight Dreams" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="artist">Artist</Label>
            <Input id="artist" placeholder="Electronic Artist" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" placeholder="Optional notes for operators" rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => setFileName('midnight_dreams.mp3')}>
            Queue upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
