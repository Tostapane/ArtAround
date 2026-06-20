// NOTA: modificare questi valori non cambia immediatamente il navigator,
// vengono visualizzate le difficolta e tempi contenute dentro al database

export const educationalLevels = ["Principiante"];

export const secPerArt = [15];

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

export const options = [
  { group: "Lettura", id: "Leggi", label: "Leggi" },
  { group: "Lettura", id: "Ferma lettura", label: "Ferma lettura" },
  { group: "Contenuto", id: "Non ho capito", label: "Non ho capito" },
  { group: "Contenuto", id: "Sintetizza", label: "Sintetizza" },
  { group: "Contenuto", id: "Approfondisci", label: "Approfondisci" },
  { group: "Contenuto", id: "Semplifica", label: "Semplifica" },
  { group: "Dettaglio", id: "Chi e' l'autore?", label: "Chi e' l'autore?" },
  { group: "Dettaglio", id: "Che stile e?", label: "Che stile e?" },
  { group: "Posizionale", id: "Dove esco?", label: "Dove esco?" },
  { group: "Posizionale", id: "Dove e il bagno?", label: "Dove e il bagno?" },
  { group: "Posizionale", id: "Dove e il bar?", label: "Dove e il bar?" },
  { group: "Posizionale", id: "Dove e lo shop?", label: "Dove lo shop?" },
  { group: "Posizionale", id: "Ci sono ostacoli?", label: "Ci sono ostacoli?" },
  { group: "Altro", id: "Altro", label: "Altro" },
];
