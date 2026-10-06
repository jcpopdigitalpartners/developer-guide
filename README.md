# Developer Playbook · GitHub Pages edition

The primary Next.js landing page for the Astro × Next.js audio course. This package contains all seven original MP3s, measured waveforms, chapter-synchronized navigation, click-to-seek-and-play, notes, practice, and the corrected Astro feature lab link.

## Publish to GitHub Pages

1. Create or open your GitHub repository. A repository named `developer-playbook` is a convenient choice; the workflow supports other names too.
2. Extract this ZIP. Copy the **contents** of `developer-playbook-github-pages` into the repository root. `package.json`, `app`, `public`, and `.github` must be at the root, not inside an extra folder. Include the `.github` folder when copying.
3. Push the files to `main`.
4. In the repository, open **Settings → Pages → Build and deployment → Source**, and choose **GitHub Actions**. Use the included workflow; you do not need to create another one.
5. Open **Actions → Deploy Developer Playbook to GitHub Pages → Run workflow**, select `main`, and run it. Future pushes to `main` will deploy automatically.
6. Wait for both `build` and `deploy` to succeed. Open the URL shown by the deployment or in **Settings → Pages**.

For `jcpopdigitalpartners/developer-playbook`, the expected address is:

`https://jcpopdigitalpartners.github.io/developer-playbook/`

The workflow reads the Pages mount path during the build. Audio, JavaScript, styles, the icon, and the home link therefore work under your repository name. User/organization repositories and custom domains can use an empty mount path. You do not need to edit the configuration for the workflow deployment.

If your branch has a different name, change `branches: [main]` in `.github/workflows/deploy-pages.yml` and run the workflow on that branch.

## Open in VS Code / WSL

Extract the package to a WSL folder, then run:

```bash
cd ~/projects/developer-playbook-github-pages
code .
```

Install Node.js 24 and pnpm 11.25.0, matching `package.json`. With npm available:

```bash
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:5173`. Local development defaults to the domain root.

## Build or verify locally

```bash
pnpm test:audio
NEXT_PUBLIC_BASE_PATH=/developer-playbook pnpm build
NEXT_PUBLIC_BASE_PATH=/developer-playbook pnpm verify:pages
```

Replace `/developer-playbook` with your repository path. Omit `NEXT_PUBLIC_BASE_PATH` for a domain-root build. The path is compiled into the output; rebuild after changing it. `out` is the generated static website. Next.js server hosting is not required.

The included `.nojekyll` file protects Next.js's `_next` directory if you separately publish a built export with branch-based Pages hosting. For that method, publish the **contents of `out`**, using the matching build path, rather than the unbuilt Next.js source. The included workflow uses GitHub Actions instead.

## Verify the published page

- Choose a chapter and play its narration.
- Pause, then click a point on the waveform. Playback should start from that point.
- Confirm the left navigation shows the playing chapter, elapsed time, and progress.
- With Auto-next enabled, let a chapter finish; the next chapter and its content should become current.
- Open the Astro feature boundary chapter and confirm its visible launch button points to `https://jcpopdigitalpartners.github.io/astro-feature/`.
- Check a narrow browser window and save a note; reload to confirm it remains in that browser.

Notes, completion, playback positions, and speed use localStorage on the current browser and origin. Existing progress on the ChatGPT-hosted page does not transfer to the new GitHub Pages origin. There is no database or account requirement.

## Edit content

`lib/lessons.ts` owns chapter text, practices, and resource links. `lib/audio.json` holds durations and measured waveform peaks. Original recordings live in `public/audio/01.mp3` through `07.mp3`. `lib/audio-controller.ts` owns playback and pending seeks. `app/page.tsx` owns the learner interface.

The external Astro and Next.js labs remain links; this package deploys the landing page and its seven recordings. No API keys or hosting credentials are required. The dependency versions and lockfile are preserved from the working project.

## Troubleshooting

- **No workflow appears:** confirm `.github/workflows/deploy-pages.yml` is committed at the repository root.
- **Pages setup fails:** select GitHub Actions in Settings → Pages, then rerun the workflow. Check the repository permits GitHub Actions and Pages.
- **Styles or audio return 404:** deploy through the included workflow, or rebuild with the exact mount path before publishing `out` manually.
- **No live URL yet:** the source files alone are not the built website; wait for the deploy job to finish.

Official references:

- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- https://nextjs.org/docs/app/guides/static-exports
- https://nextjs.org/docs/app/api-reference/config/next-config-js/basePath
