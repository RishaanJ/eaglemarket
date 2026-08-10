![logo](https://i.imgur.com/wM8Vdu8.png)

EagleMarket is a school prediction-market interface for questions students are already discussing: test averages, game results, SPW outcomes, club events, and other campus moments.

Markets use free play tokens with no cash value. Tokens cannot be purchased, withdrawn, exchanged for prizes, or converted into money.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Public landing page |
| `/auth` | Login and signup experience |
| `/markets` | Main prediction-market product |
| `/landing` | Compatibility route for the landing page |

## Current status

This repository currently contains the frontend product experience. Market data, authentication, balances, order execution, and resolution logic are represented in the UI but are not connected to a production backend yet.

## Tech stack

- Next.js 16 with the App Router
- React 19 and TypeScript
- Tailwind CSS 4
- Recharts for probability charts
- Paper Design shaders for dither effects
- Magic UI and Cult UI components
- Lucide icons

## Local development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Validation

Run the linter:

```bash
npm run lint
```

Create a production build:

```bash
npm run build
```

Run the production build locally:

```bash
npm start
```

## Project structure

```text
app/
  auth/          Login and signup route
  landing/       Landing-page implementation and styles
  markets/       Main market product
  globals.css    Shared product styles and design tokens
components/ui/   Reusable market, shader, chart, and UI components
lib/             Shared utilities
```

## Product principles

- School-specific markets only
- No real-money gambling
- Clear resolution criteria for every question
- Simple Yes/No pricing that communicates implied probability
- Accessible, responsive interfaces with reduced-motion support

## Disclaimer

EagleMarket is designed as a free, school-oriented forecasting game. EAG is a fictional play-token balance and has no monetary value.
