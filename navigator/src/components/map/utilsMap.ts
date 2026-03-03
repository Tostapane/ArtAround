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