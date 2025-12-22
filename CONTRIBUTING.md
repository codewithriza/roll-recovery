# Contributing to Roll Recovery

Thanks for your interest in contributing! Here's how to get started.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/roll-recovery.git
   cd roll-recovery
   ```
3. **Install** dependencies:
   ```bash
   npm install
   ```
4. **Start** the dev server:
   ```bash
   npm start
   ```
5. Open `http://localhost:3000` to verify everything works

## Making Changes

1. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes
3. Test locally to make sure nothing is broken
4. Commit with a clear message:
   ```bash
   git commit -m "feat: add support for 1st year hall tickets"
   ```
5. Push and open a Pull Request

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Use |
|--------|-----|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation changes |
| `style:` | CSS/UI changes (no logic change) |
| `refactor:` | Code refactoring |
| `perf:` | Performance improvement |
| `chore:` | Build/tooling changes |

## Project Structure

```
server.js          → Express backend + Puppeteer automation
public/index.html  → Web UI
public/style.css   → Styles
public/app.js      → Frontend JavaScript
index.js           → Original console script
```

## Ideas for Contributions

- Support for TSBIE 1st Year hall tickets
- Support for supplementary exam hall tickets
- Results page scraping (marks/grades)
- Batch scanning (multiple roll numbers at once)
- Docker support for easier deployment
- Rate limiting detection and auto-adjustment
- Export results to CSV/JSON
- Dark/light theme toggle
- Progress estimation based on scan speed

## Code Style

- Use `const`/`let`, never `var`
- Use arrow functions where appropriate
- Keep functions small and focused
- Add comments for non-obvious logic
- Frontend: vanilla JS only (no frameworks)

## Reporting Issues

When reporting a bug, please include:

1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Browser/Node.js version
5. Screenshots if applicable

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
