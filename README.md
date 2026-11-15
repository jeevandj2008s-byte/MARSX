# MARSX 🚀

> AI-powered Mars mission planning at your fingertips.

MARSX is an AI-powered Mars mission planner that lets users explore Mars, create astronaut walking routes, calculate distances and mission durations, and generate AI-powered mission briefings using interactive maps and scientific data.

## Features

- 🗺️ Interactive Mars map exploration
- 🧑‍🚀 Astronaut walking route creation
- 📏 Distance and mission duration calculator
- 🤖 AI-powered mission briefings
- 🔭 Scientific data integration

## Screenshots

> Coming soon – interactive map view, route planner UI, and mission briefing panel.

## Tech Stack

| Layer       | Technology         |
|-------------|-------------------|
| Frontend    | React / Next.js   |
| Maps        | Leaflet.js        |
| AI          | OpenAI API        |
| Data        | NASA Mars APIs    |
| Styling     | Tailwind CSS      |

## Getting Started

Clone the repository and follow the setup instructions below.

### Prerequisites

- Node.js >= 18
- npm or yarn
- OpenAI API key
- NASA API key (free at [api.nasa.gov](https://api.nasa.gov))

```bash
git clone https://github.com/jeevandj2008s-byte/MARSX.git
cd MARSX
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the app.

## Environment Variables

Create a `.env.local` file in the root directory:

```
OPENAI_API_KEY=your_openai_key_here
NASA_API_KEY=your_nasa_key_here
```

## FAQ

**Q: Do I need a NASA API key?**
A: Yes, a free NASA API key can be obtained at [https://api.nasa.gov](https://api.nasa.gov).

**Q: Which Node.js version is required?**
A: Node.js 18 or higher is recommended.

**Q: Is MARSX free to use?**
A: Yes, MARSX is open-source and free under the MIT license.

## Roadmap

- [x] Interactive Mars map
- [x] Route planner
- [x] AI mission briefings
- [ ] Real-time Mars weather integration
- [ ] Multiplayer mission planning
- [ ] 3D terrain visualisation
- [ ] Offline mode support
- [ ] Mission history export (PDF/CSV)

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Acknowledgements

- [NASA Open APIs](https://api.nasa.gov/) for Mars scientific data
- [OpenAI](https://openai.com/) for AI-powered mission briefings
- [Leaflet.js](https://leafletjs.com/) for the interactive map framework
- The open-source community for inspiration and tools

## License

MIT © MARSX Contributors
