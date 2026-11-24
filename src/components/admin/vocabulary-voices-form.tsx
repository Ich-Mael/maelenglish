"use client";

import { useState } from "react";
import type { Voice } from "@/lib/ai/types";
import { AdminForm, Submit } from "@/components/admin/forms";
import { VoiceSelect } from "@/components/admin/story/fields";
import { saveVocabularyVoicesAction } from "@/app/admin/actions";

/** Admin → AI usage: the ElevenLabs voices reading the vocabulary (American and British). */
export function VocabularyVoicesForm({ voices, initial }: { voices: Voice[]; initial: { us: { id: string; name: string }; gb: { id: string; name: string } } }) {
  const [us, setUs] = useState(initial.us);
  const [gb, setGb] = useState(initial.gb);
  return (
    <AdminForm action={saveVocabularyVoicesAction} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <span className="text-sm font-semibold">American English (US)</span>
          <VoiceSelect voices={voices} value={us.id} name={us.name} onChange={(id, name) => setUs({ id, name })} />
        </div>
        <div className="grid gap-1">
          <span className="text-sm font-semibold">British English (UK)</span>
          <VoiceSelect voices={voices} value={gb.id} name={gb.name} onChange={(id, name) => setGb({ id, name })} />
        </div>
      </div>
      <input type="hidden" name="usId" value={us.id} />
      <input type="hidden" name="usName" value={us.name} />
      <input type="hidden" name="gbId" value={gb.id} />
      <input type="hidden" name="gbName" value={gb.name} />
      <div>
        <Submit variant="secondary">Save the voices</Submit>
      </div>
    </AdminForm>
  );
}
