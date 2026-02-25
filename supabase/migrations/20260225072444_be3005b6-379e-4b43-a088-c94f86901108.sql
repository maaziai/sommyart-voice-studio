CREATE POLICY "Users can update own cloned voices"
ON public.cloned_voices
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);