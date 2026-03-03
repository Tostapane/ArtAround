export const config = [
        { svgId: 'art-001', title: 'The Starry Night', info: 'Oil on canvas, 1889. Post-Impressionism.' },
        { svgId: 'art-002', title: 'The Persistence of Memory', info: 'Oil on canvas, 1931. Surrealism.' },
        { svgId: 'art-003', title: 'David', info: 'Marble sculpture, 1504. Renaissance.' },
        { svgId: 'art-004', title: 'Girl with a Pearl Earring', info: 'Oil on canvas, 1665. Dutch Golden Age.' },
        { svgId: 'art-005', title: 'The Night Watch', info: 'Oil on canvas, 1642. Baroque.' },
        { svgId: 'art-006', title: 'The Kiss', info: 'Oil and gold leaf on canvas, 1908. Symbolism.' },
        { svgId: 'art-007', title: 'Guernica', info: 'Oil on canvas, 1937. Cubism/Surrealism.' },
        { svgId: 'art-008', title: 'The Thinker', info: 'Bronze sculpture, 1904. Modern sculpture.' },
        { svgId: 'art-009', title: 'American Gothic', info: 'Oil on beaverboard, 1930. Regionalism.' },
        { svgId: 'art-010', title: 'Water Lilies', info: 'Oil on canvas, 1919. Impressionism.' },
        { svgId: 'art-011', title: 'The Scream', info: 'Tempera and pastel on board, 1893. Expressionism.' },
        { svgId: 'art-012', title: 'The Creation of Adam', info: 'Fresco, 1512. High Renaissance.' }
];

export interface genericArtwork {
    svgId: string;
    title: string;
    info: string;
}

export const options = [
    { group: 'Contenuto', id: 'Non ho capito', label: 'Non ho capito' },
    { group: 'Contenuto', id: 'Sintetizza', label: 'Sintetizza' },
    { group: 'Contenuto', id:'Approfondisci', label: 'Approfondisci' },
    { group: 'Contenuto', id:'Semplifica', label: 'Semplifica' },
    { group: 'Dettaglio', id:"Chi e' l'autore?", label: "Chi e' l'autore?" },
    { group: 'Dettaglio', id:'Che stile e?', label: 'Che stile e?' },
    { group: 'Posizionale', id: 'Dove esco?', label: 'Dove esco?' },
    { group: 'Posizionale', id: 'Dove e il bagno?', label: 'Dove e il bagno?' },
    { group: 'Posizionale', id: 'Dove e il bar?', label: 'Dove e il bar?' },
    { group: 'Posizionale', id: 'Dove e lo shop?', label: 'Dove lo shop?' },
    { group: 'Posizionale', id: 'Ci sono ostacoli?', label: 'Ci sono ostacoli?' }
];