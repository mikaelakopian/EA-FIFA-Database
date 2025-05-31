# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a FIFA/EA Sports FC database management application that helps manage football player data, teams, and leagues by integrating with SoFIFA and Transfermarkt.

## Architecture

### Frontend (Client)
- **Stack**: React + TypeScript + Vite + HeroUI + Tailwind CSS
- **Location**: `/client`
- **Key features**:
  - Project management for organizing leagues and teams
  - Real-time WebSocket updates for background tasks
  - Player filtering and team management interfaces
  - Progress tracking via ProgressContext

### Backend (Server)
- **Stack**: FastAPI (Python) with WebSocket support
- **Location**: `/server`
- **Data storage**: JSON file-based in `/server/fc25/` and `/server/projects/`
- **Key features**:
  - RESTful API endpoints for teams, leagues, players, managers
  - Web scraping from SoFIFA and Transfermarkt
  - WebSocket for real-time progress updates
  - Image processing and color extraction

## Development Commands

### Frontend
```bash
cd client
npm install          # Install dependencies
npm run dev         # Start development server (Vite)
npm run build       # Build production bundle
npm run lint        # Run ESLint with auto-fix
npm run preview     # Preview production build
```

### Backend
```bash
cd server
pip install -r requirements.txt    # Install Python dependencies
uvicorn server:app --reload       # Start development server with hot reload
```

## Key API Endpoints

The server exposes multiple routers from `/server/endpoints/`:
- `/teams` - Team management
- `/leagues` - League operations
- `/players` - Player data and scraping
- `/projects` - Project management
- `/transfermarkt` - Transfermarkt integration
- `/sofifa` - SoFIFA integration
- `/ws` - WebSocket endpoint for real-time updates

## WebSocket Integration

The application uses WebSocket connections for real-time progress updates during long-running operations like player data scraping. The WebSocket manager is located in `/server/endpoints/websocket.py`.

## Data Structure

- **Projects**: Stored in `/server/projects/` with metadata in `projects_metadata.json`
- **Game Data**: FIFA/FC25 data stored in `/server/fc25/data/`
- **Images**: Player photos and flags in `/server/fc25/images/`
- **Language Strings**: Localization data in `/server/fc25/loc/`

## Important Implementation Details

### Transfermarkt Integration
The Transfermarkt scraping system uses 6 different strategies to reliably find player URLs (see `/server/TRANSFERMARKT_IMPROVEMENTS.md` for details):
1. Direct text match
2. Case-insensitive search
3. URL-based detection
4. External links section
5. Info/profile section
6. JavaScript/script tag parsing

### Rate Limiting
Both SoFIFA and Transfermarkt scrapers implement respectful rate limiting with exponential backoff and randomized delays to avoid overwhelming external servers.

### No Test Infrastructure
Currently, there are no automated tests in the project. Testing would need to be set up from scratch if required.