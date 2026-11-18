"use client";

import { useId, useState } from "react";
import { Editor } from "@hugerte/hugerte-react";

/*
 * HugeRTE rich-text field for long staff texts. HugeRTE is served from /hugerte (copied from
 * node_modules by scripts/copy-hugerte.mjs) and only loads on admin pages that use this field.
 * The HTML goes into a hidden input (`name`) and is sanitised on the server when saved.
 * `defaultValue` must already be HTML (use `toEditorHtml` on the server for older Markdown / text).
 */
export function RichTextEditor({
  label,
  name,
  defaultValue = "",
  hint,
  placeholder,
  minHeight = 220,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  hint?: string;
  placeholder?: string;
  minHeight?: number;
}) {
  const [value, setValue] = useState(defaultValue);
  const [ready, setReady] = useState(false);
  const id = useId();
  return (
    <div className="grid content-start gap-1 text-sm">
      <span id={`${id}-label`} className="font-medium">
        {label}
      </span>
      <input type="hidden" name={name} value={value} />
      <div className="relative overflow-hidden rounded-xl border border-input bg-background focus-within:border-primary focus-within:ring-3 focus-within:ring-ring/30" style={{ minHeight }}>
        {!ready && <div className="absolute inset-0 animate-pulse bg-muted/60" aria-hidden />}
        <Editor
          id={id}
          hugerteScriptSrc="/hugerte/hugerte.min.js"
          initialValue={defaultValue}
          onEditorChange={(html) => setValue(html)}
          onInit={() => setReady(true)}
          init={{
            language: "fr_FR",
            language_url: "/hugerte-langs/fr_FR.js",
            base_url: "/hugerte",
            suffix: ".min",
            menubar: false,
            statusbar: false,
            branding: false,
            plugins: "lists link autolink table autoresize",
            toolbar: "blocks | bold italic underline | bullist numlist | blockquote link table | removeformat | undo redo",
            toolbar_mode: "wrap",
            block_formats: "Paragraphe=p; Titre=h2; Sous-titre=h3",
            min_height: minHeight,
            max_height: 640,
            autoresize_bottom_margin: 16,
            placeholder,
            link_default_target: "_blank",
            link_target_list: false,
            link_title: false,
            link_default_protocol: "https",
            table_advtab: false,
            table_cell_advtab: false,
            table_row_advtab: false,
            table_appearance_options: false,
            invalid_elements: "img,script,iframe,object,embed,style,video,audio,form,input",
            paste_data_images: false,
            entity_encoding: "raw",
            iframe_aria_text: label,
            content_style: [
              "body{font-family:Outfit,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#1c2140;margin:12px 14px}",
              "h2{font-size:1.45em;color:#141f4d;margin:.6em 0 .3em} h3{font-size:1.2em;color:#141f4d;margin:.6em 0 .3em}",
              "a{color:#364fab} strong{color:#141f4d}",
              "blockquote{border-left:4px solid #ff5757;background:#fff1f1;margin:.5em 0;padding:8px 14px;border-radius:12px}",
              "table{border-collapse:collapse;width:100%} td,th{border:1px solid #e3e6f0;padding:6px 10px} th{background:#eef1fb;text-align:left}",
            ].join(""),
          }}
        />
      </div>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
