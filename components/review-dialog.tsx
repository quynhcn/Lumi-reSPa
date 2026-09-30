'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { StarPicker } from '@/components/star-picker';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ReviewDialogProps {
  appointmentId: string | null;
  serviceName?: string;
  onClose: () => void;
  onDone: (rating: number) => void;
}

/** Star rating + comment for a completed appointment (RPC submit_review checks ownership & status). */
export function ReviewDialog({ appointmentId, serviceName, onClose, onDone }: ReviewDialogProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!appointmentId || !rating) return;
    setSending(true);
    const { error } = await supabase.rpc('submit_review', { p_appointment_id: appointmentId, p_rating: rating, p_comment: comment });
    setSending(false);
    if (error) {
      toast.error(error.message.includes('ALREADY_REVIEWED') ? 'Bạn đã đánh giá lịch hẹn này rồi.' : 'Không gửi được đánh giá.');
      return;
    }
    track('review_submit', { rating });
    toast.success('Cảm ơn bạn đã đánh giá!');
    onDone(rating);
    setRating(0);
    setComment('');
  };

  return (
    <Dialog open={!!appointmentId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="page-title text-2xl">Buổi hẹn thế nào?</DialogTitle>
          <DialogDescription>{serviceName ? `Đánh giá ${serviceName}. ` : ''}Nhận xét của bạn giúp spa phục vụ tốt hơn.</DialogDescription>
        </DialogHeader>
        <StarPicker value={rating} onChange={setRating} />
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder="Điều bạn thích nhất, hoặc điều spa nên cải thiện…"
          aria-label="Nhận xét"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Để sau</Button>
          <Button onClick={submit} disabled={!rating || sending}>
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gửi đánh giá
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
