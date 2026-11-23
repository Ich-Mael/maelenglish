"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { audioAction } from "@/app/(app)/story-actions";

/*
 * Plays Story Mode audio: a content ref (voiced on first use by the server, cached in R2) or a
 * direct URL. One shared <audio> per hook; URLs are cached for the page's life. Falls back on the
 * browser's English voice when no audio is available (no ElevenLabs key, offline…).
 */

const urls = new Map<string, string | null>();

export function useStoryAudio(storyId: string, episodeId: string) {
  const el = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(
    () => () => {
      el.current?.pause();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    },
    [],
  );

  const stop = useCallback(() => {
    el.current?.pause();
    window.speechSynthesis?.cancel();
    setPlaying(null);
  }, []);

  const playUrl = useCallback((id: string, url: string, rate = 1) => {
    if (!el.current) el.current = new Audio();
    const a = el.current;
    a.pause();
    a.src = url;
    a.playbackRate = rate;
    a.onended = () => setPlaying((p) => (p === id ? null : p));
    a.onerror = () => setPlaying(null);
    setPlaying(id);
    return a.play().catch(() => setPlaying(null));
  }, []);

  const speakFallback = useCallback((id: string, text: string, rate = 1) => {
    const synth = window.speechSynthesis;
    if (!synth || !text) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB";
    u.rate = 0.95 * rate;
    u.onend = () => setPlaying((p) => (p === id ? null : p));
    setPlaying(id);
    synth.speak(u);
  }, []);

  /** Plays a content ref (`intro:0`, `activity:a6`, `model`…); `fallbackText` is spoken by the browser if needed. */
  const play = useCallback(
    async (ref: string, fallbackText = "", rate = 1) => {
      if (playing === ref) return stop();
      const key = `${storyId}/${episodeId}/${ref}`;
      let url = urls.get(key);
      if (url === undefined) {
        setLoading(ref);
        const r = await audioAction(storyId, episodeId, ref).catch(() => null);
        setLoading(null);
        url = r && r.ok ? r.url : null;
        urls.set(key, url);
      }
      if (url) return playUrl(ref, url, rate);
      speakFallback(ref, fallbackText, rate);
    },
    [storyId, episodeId, playing, playUrl, speakFallback, stop],
  );

  return { play, playUrl, stop, playing, loading };
}
