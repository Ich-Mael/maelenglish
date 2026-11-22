import "server-only";
import type { Accent, SynthesizedAudio, TtsService } from "./types";

/*
 * Azure AI Speech — neural text-to-speech (DECISIONS.md: Azure for speech). REST API, no SDK:
 * POST https://<region>.tts.speech.microsoft.com/cognitiveservices/v1 with SSML, MP3 back.
 * Needs AZURE_SPEECH_KEY + AZURE_SPEECH_REGION (e.g. westeurope). First use: dictionary word and
 * example audio (src/lib/dictionary.ts), generated once and stored.
 */

export const isAzureSpeechConfigured = () => Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);

/** Neural voices per accent (Azure has no Ghanaian English voice: the Nigerian one stands in). */
export const AZURE_VOICES: Record<Accent, { lang: string; female: string; male: string }> = {
  american: { lang: "en-US", female: "en-US-JennyNeural", male: "en-US-GuyNeural" },
  british: { lang: "en-GB", female: "en-GB-SoniaNeural", male: "en-GB-RyanNeural" },
  nigerian: { lang: "en-NG", female: "en-NG-EzinneNeural", male: "en-NG-AbeoNeural" },
  ghanaian: { lang: "en-NG", female: "en-NG-EzinneNeural", male: "en-NG-AbeoNeural" },
  indian: { lang: "en-IN", female: "en-IN-NeerjaNeural", male: "en-IN-PrabhatNeural" },
  kenyan: { lang: "en-KE", female: "en-KE-AsiliaNeural", male: "en-KE-ChilembaNeural" },
};

/** 24 kHz, 48 kbit/s mono MP3: clear speech, ~6 KB per second. */
const FORMAT = "audio-24khz-48kbitrate-mono-mp3";
const BITRATE = 48_000;
/** Published neural TTS price, about $15 per million characters → micro-USD per character. */
export const AZURE_TTS_MICROS_PER_CHAR = 15;

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** The SSML sent to Azure (exported for tests). `rate`: 1 = normal, 0.8 = 20 % slower. */
export function ssml(text: string, opts: { accent?: Accent; gender?: "female" | "male"; rate?: number } = {}) {
  const v = AZURE_VOICES[opts.accent ?? "american"];
  const voice = v[opts.gender ?? "female"];
  const rate = opts.rate && opts.rate !== 1 ? `${Math.round((opts.rate - 1) * 100)}%` : null;
  const body = rate ? `<prosody rate="${rate}">${xml(text)}</prosody>` : xml(text);
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${v.lang}"><voice name="${voice}">${body}</voice></speak>`;
}

export class AzureTtsService implements TtsService {
  readonly name = "azure";

  async synthesize(text: string, opts: { accent?: Accent; gender?: "female" | "male"; rate?: number } = {}): Promise<SynthesizedAudio> {
    const region = process.env.AZURE_SPEECH_REGION!;
    const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY!,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": FORMAT,
        "User-Agent": "maelenglish",
      },
      body: ssml(text, opts),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Azure TTS ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const data = new Uint8Array(await res.arrayBuffer());
    if (!data.length) throw new Error("Azure TTS: empty audio");
    return { data, mime: "audio/mpeg", durationS: Math.round(((data.length * 8) / BITRATE) * 10) / 10 };
  }
}
