
-- Create table for storing cloned voices
CREATE TABLE public.cloned_voices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  elevenlabs_voice_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cloned_voices ENABLE ROW LEVEL SECURITY;

-- Users can only see their own cloned voices
CREATE POLICY "Users can view own cloned voices"
ON public.cloned_voices FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own cloned voices
CREATE POLICY "Users can create own cloned voices"
ON public.cloned_voices FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own cloned voices
CREATE POLICY "Users can delete own cloned voices"
ON public.cloned_voices FOR DELETE
USING (auth.uid() = user_id);
