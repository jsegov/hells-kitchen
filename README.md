# Recipe Manager - Full Stack Take-Home Exercise

## Overview
Create a recipe management application that allows users to view, search, and organize recipes. This exercise tests your ability to build a full-stack web application with a focus on data relationships and user experience.

## Current Implementation

- The app is implemented with a Next.js App Router frontend in `frontend-app` and an Express backend in `backend-app`.
- `/` redirects to `/recipes`.
- `/recipes` displays recipe list cards and supports filtering by recipe name, tags, and ingredients through query parameters.
- `/recipes/:id` displays ingredients with quantities, cooking instructions, tags, and nutrition totals/per-serving values calculated from ingredients.
- The backend exposes `GET /api/recipes` for list-safe recipe data and `GET /api/recipes/:id` for full recipe detail data.
- The mock database is `backend-app/db/data.json`.

## Tips
- Use whatever frameworks/tools you're most comfortable with
- Focus on creating a working MVP before adding advanced features
- Be sure to document any assumptions or known limitations
- Test your application with different scenarios

## Setup Instructions

#### Backend setup
```
cd backend-app
npm ci
npm run dev # Starts express server on port 8080
```

#### Frontend setup
```
cd frontend-app
npm ci
npm run dev # Starts nextjs frontend server on port 3000, or the next available port
```

#### Database setup
```
The application uses `backend-app/db/data.json` as a mock database
```

#### Environment variables

- `API_BASE_URL`: frontend server-side API base URL. Defaults to `http://localhost:8080`.
- `CORS_ORIGIN`: optional comma-separated backend CORS allowlist. Defaults to local frontend origins on ports `3000` and `3001`; use `*` to allow any origin.

#### Quality gates

```
cd backend-app && npm run check
cd frontend-app && npm run check
cd frontend-app && npm run build
```

**Note: This implementation uses the provided Next.js + Express scaffold.**

## Requirements

#### Core Features (Required)
- Display a list of recipes with their basic information (`/recipes`)
- Implement recipe detail page (`/recipes/:id`) showing:
  - Ingredients with quantities
  - Cooking instructions
  - Tags
  - Nutritional information (calculated from ingredients)
- Add search/filter functionality on (`/recipes`) by:
  - Recipe name
  - Tags
  - Ingredients

#### Example Advanced Features (Bonus Points. Feel free to implement any of these or add your own. Some examples below)
- Implement dietary restriction filters (e.g., vegetarian, vegan, gluten-free)
- Create a calorie calculator based on serving size
- Add recipe scaling functionality (e.g., adjust ingredients for different serving sizes)
- Implement recipe favoriting/saving
- Add sorting options (prep time, difficulty, etc.)
- Add a "shopping list" generator for selected recipes
- Incorporate an LLM feature
- Types

## Evaluation Criteria
- Code organization and clarity
- UI/UX design and responsiveness
- API design and implementation
- Error handling and edge cases
- Performance considerations
- TypeScript/JavaScript best practices

## Submission
1. Update this README with a new section below called `Candidate Notes:
   - Setup instructions if you've added any requirements
   - Brief explanation of your implementation choices
   - List of completed features
   - Any assumptions made
   - Known limitations or bugs
   - Additional features you'd add with more time
 
 
2. Send us (via email to scott.nguyen@sprx.tax & anthony.difalco@sprx.tax):
   - A zip file of the entire project (frontend and backend)
   - A link to a deployed version of the application (bonus points)


Good luck! We're excited to see your implementation.
