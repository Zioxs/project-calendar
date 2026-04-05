# Project Calendar

A modern Next.js application that visually tracks your project deadlines by dynamically generating beautiful, shareable calendar timeline images on the fly.

## Features

- **Dynamic OG Image Generation**: Generates a rich, interactive-looking timeline image using `@vercel/og` (`next/og`). Features a day-by-day calendar grid and dynamic progress bars for each project.
- **Manual Setup Mode**: Build your own timeline by adding projects, selecting deadlines, and picking custom colors. It generates a long, portable URL containing all your parameters.
- **Live Google Tasks Integration**: Sign in with Google to unlock a short, dynamically updating URL (`/api/og?source=google`). Every time this image is loaded, the server securely fetches your active Google Tasks and renders them on the fly—assigning beautiful, deterministic pastel colors to each task.
- **One-Click Clipboard**: Easily copy the generated dynamic image URLs for sharing or embedding.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS & Vanilla CSS
- **Authentication**: NextAuth.js (v5 Beta)
- **API Integration**: Google APIs (`googleapis`)
- **Image Generation**: Next.js ImageResponse (`next/og`)

## Getting Started

### 1. Installation

Clone the repository and install dependencies:

```bash
npm install
```

### 2. Environment Variables

To use the **Live Google Mode**, you must configure OAuth credentials. 

Create a `.env.local` file in the root directory:

```env
AUTH_SECRET="generate-a-random-secret-string" # e.g. openssl rand -hex 32
AUTH_GOOGLE_ID="your-google-oauth-client-id.apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="your-google-oauth-client-secret"
```

**How to get your Google Credentials:**
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a Project and enable the **Google Tasks API**.
3. Go to **APIs & Services > OAuth consent screen**. Set up the screen and add `https://www.googleapis.com/auth/tasks.readonly` to your scopes. Ensure you add your email as a **Test User**.
4. Go to **Credentials** and create an **OAuth client ID** (Web Application).
5. Add `http://localhost:3000/api/auth/callback/google` to the Authorized Redirect URIs.
6. Copy your generated Client ID and Client Secret into the `.env.local` file.

### 3. Run the Development Server

Start the local server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or whichever port Next.js assigns) in your browser.

## How the Image Generation Works

The `/api/og` endpoint returns an actual image, not an HTML page. It processes parameters either via:
1. **URL Query Strings** (e.g., `?goal[0][title]=Project&goal[0][date]=...`)
2. **Google Tasks API** (when `?source=google` is passed, it reads the viewer's session cookie and fetches active tasks).

This allows you to embed the generated URL directly into `<img>` tags, Markdown files, or social media metadata.
