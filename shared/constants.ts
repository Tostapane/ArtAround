// NOTA: modificare questi valori non cambia immediatamente il navigator,
// vengono visualizzate le difficolta e tempi contenute dentro al database

export const educationalLevels = ["Principiante", "Intermedio", "Avanzato"];

export const secPerArt = [15, 30, 60];

// Licenze di pubblicazione selezionabili dall'autore nel marketplace.
// La prima e' il default proposto in fase di creazione.
export const licenses = [
  "Tutti i diritti riservati",
  "CC BY 4.0",
  "CC BY-SA 4.0",
  "CC BY-NC 4.0",
  "CC0 (Pubblico dominio)",
];

// Lingua di partenza dei contenuti salvati nel database (italiano).
// La traduzione live converte da questa lingua a quella scelta dall'utente.
export const SOURCE_LANG = "it";

// Una lingua selezionabile nel navigator. I contenuti del DB sono in italiano
// e vengono tradotti/sintetizzati live nella lingua scelta.
export interface Language {
  name: string; // nome mostrato nel selettore (nella lingua stessa)
  translate: string; // codice per Google Cloud Translation (es. "fr", "zh-CN")
  tts: string; // codice BCP-47 per la sintesi vocale (Google TTS)
  stt: string; // codice BCP-47 per il riconoscimento vocale (Google STT)
}

// Solo lingue con supporto COMPLETO (traduzione + sintesi + riconoscimento):
// cosi' "ascolto in cinese da cinese" funziona davvero per ogni voce in lista.
export const languages: Language[] = [
  { name: "Italiano", translate: "it", tts: "it-IT", stt: "it-IT" },
  { name: "English", translate: "en", tts: "en-US", stt: "en-US" },
  { name: "Français", translate: "fr", tts: "fr-FR", stt: "fr-FR" },
  { name: "Español", translate: "es", tts: "es-ES", stt: "es-ES" },
  { name: "Deutsch", translate: "de", tts: "de-DE", stt: "de-DE" },
  { name: "Português", translate: "pt", tts: "pt-BR", stt: "pt-BR" },
  { name: "中文", translate: "zh-CN", tts: "cmn-CN", stt: "cmn-Hans-CN" },
  { name: "日本語", translate: "ja", tts: "ja-JP", stt: "ja-JP" },
  { name: "한국어", translate: "ko", tts: "ko-KR", stt: "ko-KR" },
  { name: "Русский", translate: "ru", tts: "ru-RU", stt: "ru-RU" },
  { name: "Nederlands", translate: "nl", tts: "nl-NL", stt: "nl-NL" },
  { name: "Polski", translate: "pl", tts: "pl-PL", stt: "pl-PL" },
  { name: "Türkçe", translate: "tr", tts: "tr-TR", stt: "tr-TR" },
];

// Un comando del vocabolario controllato. `surface` indica DOVE vive il pulsante
// on-screen equivalente (richiesto dalla specifica): "panel" = griglia dell'
// OptionsBar, "card" = pulsanti di navigazione dentro la scheda dell'opera.
// Il vocabolario resta UNICO (mapRequest mappa su tutti i comandi); cambia solo
// la superficie su cui il comando viene mostrato come pulsante.
export interface CommandOption {
  group: string;
  id: string;
  label: string;
  surface: "panel" | "card";
}

export const options: CommandOption[] = [
  { group: "Lettura", id: "Leggi", label: "Leggi", surface: "panel" },
  { group: "Lettura", id: "Ferma lettura", label: "Ferma lettura", surface: "panel" },
  { group: "Contenuto", id: "Non ho capito", label: "Non ho capito", surface: "panel" },
  { group: "Contenuto", id: "Sintetizza", label: "Sintetizza", surface: "panel" },
  { group: "Contenuto", id: "Approfondisci", label: "Approfondisci", surface: "panel" },
  { group: "Contenuto", id: "Semplifica", label: "Semplifica", surface: "panel" },
  { group: "Dettaglio", id: "Chi e' l'autore?", label: "Chi e' l'autore?", surface: "panel" },
  { group: "Dettaglio", id: "Che stile e?", label: "Che stile e?", surface: "panel" },
  { group: "Posizionale", id: "Dove esco?", label: "Dove esco?", surface: "panel" },
  { group: "Posizionale", id: "Dove e il bagno?", label: "Dove e il bagno?", surface: "panel" },
  { group: "Posizionale", id: "Dove e il bar?", label: "Dove e il bar?", surface: "panel" },
  { group: "Posizionale", id: "Dove e lo shop?", label: "Dove lo shop?", surface: "panel" },
  { group: "Posizionale", id: "Ci sono ostacoli?", label: "Ci sono ostacoli?", surface: "panel" },
  // Navigazione: comandi vocali riconosciuti, ma il loro pulsante equivalente
  // sta DENTRO la scheda (Card), non nella griglia dei comandi.
  { group: "Navigazione", id: "Prossimo", label: "Prossimo", surface: "card" },
  { group: "Navigazione", id: "Precedente", label: "Precedente", surface: "card" },
  { group: "Altro", id: "Altro", label: "Altro", surface: "panel" },
];
