# ArtAround - Full Technical Specification

## 1. Project Overview
ArtAround is a full-stack platform designed to bridge the gap between art authors and visitors. It allows authors to create educational content (descriptions, audioguides) for artworks and visitors to explore these artworks via a map-based navigator or planned tours (visits).

## 2. Architecture & Tech Stack

### 2.1 Unified Backend (Server)
- **Entry Point**: `server/src/index.ts`
- **Port**: 8000
- **Technology**: Node.js, Express, Mongoose.
- **Database**: MongoDB.
- **Role**: Serves API requests and static frontend files.

### 2.2 Navigator (Visitor App)
- **Entry Point**: `navigator/src/main.ts`
- **Technology**: Vue.js 3, Vite, Tailwind CSS.
- **Role**: Interactive map interface and guide features.

### 2.3 Marketplace (Author/Visitor Hub)
- **Entry Point**: `marketplace/src/frontend/app.ts`
- **Technology**: Alpine.js, TypeScript.
- **Role**: Visit programming, content publishing, and wallet management.

## 3. Shared Data Structures (`shared/types.ts`)

- **Artwork**: Physical or digital piece of art.
  - `wikiDataUri`, `name`, `image`, `author`, `style`, `locationId`.
- **Item**: Creative content/description associated with an artwork.
  - `about` (Artwork ref), `educationalLevel`, `timeRequired`, `text`.
- **Visit**: A curated list of Items forming a tour.
  - `itemListElement` (IDs), `logistics` (directions).
- **User**: Role-based access (`autore` | `visitatore`), wallet, and collection.

## 4. API Reference & Endpoints

### 4.1 Artworks (`/api/artworks`)
- `GET /`: Returns all artworks in DB.
- `GET /:id/items`: Returns items for an artwork, grouped by author.

### 4.2 Items (`/api/items`)
- `GET /author/:authorName`: Retrieves content by a specific author.
- `POST /`: Upsert content (Supports Marketplace & Schema.org formats).
- `POST /batch`: Batch retrieval by IDs.

### 4.3 Visits (`/api/visits`)
- `GET /`: List all available visits.
- `GET /:id`: Specific visit details.
- `POST /`: Upsert a visit/tour.

### 4.4 LLM & AI (`/api/llm`)
- `POST /addInfo`: Context-aware AI description enrichment.

## 5. Database Models (Mongoose)
Models leverage shared TypeScript interfaces and extend them with Schema.org metadata.

- **ArtworkModel (`IArtwork`)**: Extends `SharedArtwork`.
- **ItemModel (`IItem`)**: Extends `Omit<SharedItem, "about">`. Stores `about` as a string ID.
- **VisitModel (`IVisit`)**: Extends `SharedVisit`.

## 6. Setup & Installation

### Prerequisites
- Node.js (v18+)
- MongoDB (Local or via Docker)

### Installation
1. Clone the repository.
2. Install dependencies in each directory (`server/`, `marketplace/`, `navigator/`):
   ```bash
   npm install
   ```

### Environment Variables
Create a `.env` file in `server/` with:
- `MONGO_URI`
- `LLM_API_KEY` (if required)

### Running the Project
1. Start the backend: `cd server && npm run dev`
2. Backend serves the Marketplace at `http://localhost:8000`
3. Start Navigator (dev mode): `cd navigator && npm run dev`
