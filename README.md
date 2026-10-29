# Genshin Dummy Guesser

Guess the team based on Millastra Wonderland Test Dummy screenshots (with information hidden)!

## Tools

- Vite
- React
- Supabase
- TailwindCSS
- Deno

## Contributing

### Roadmap

For more information on planned features, visit: https://watchfuls.github.io/genshinpuzzle/#/roadmap

### Requirements

Deno is required for this project. See https://docs.deno.com/runtime/getting_started/installation/ for more information

### Scripts

- `deno task dev` - Start development server
- `deno task build` - Build for production
- `deno task check` - Check code formatting and linting
- `deno task generate:elements` - Generate character element mappings from game data

Character and element icons are sourced from the sibling `../genshin-shared`
folder. `npm run dev` and `npm run build` copy them into the ignored
`public/icons/` build input. Set `GENSHIN_SHARED_DIR` to override that path.
GitHub Actions checks out `Watchfuls/genshin-shared` before building.

For GitHub Pages builds, add `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` as repository Actions secrets. These are required for
the deployed app to load daily and endless puzzles.

## GitHub Pages deployment

Set Settings → Pages → Source to **GitHub Actions**. The workflow deploys on
pushes to `main`; it requires the public `Watchfuls/genshin-shared` repository
to contain the shared `icons/` directory.
