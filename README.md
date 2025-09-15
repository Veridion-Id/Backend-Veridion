# Veridion Backend API

A clean, scalable NestJS backend application built with TypeScript and following Domain-Driven Design (DDD) principles with a layered architecture.

## 🏗️ Architecture

This project follows a **layered architecture** pattern with clear separation of concerns:

```
src/
├── config/           # Configuration & environment validation
├── core/             # Logger, errors, utilities
├── domain/           # Entities, value objects, ports/interfaces
├── application/      # Services, use cases
├── infrastructure/   # External services (DB, cache, APIs)
├── interfaces/       # Controllers, DTOs, presenters
├── modules/          # Feature modules that bind everything
└── test-utils/       # Testing utilities
```

### 🎯 Design Principles

- **Domain-Driven Design**: Business logic lives in the domain layer
- **Clean Architecture**: Dependencies point inward, framework-agnostic domain
- **Separation of Concerns**: Each layer has a specific responsibility
- **Testability**: Easy to mock and test each layer independently

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 or higher)
- npm (v8 or higher)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Veridion-Id/Backend-Veridion.git
   cd Backend-Veridion
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Edit .env with your configuration
   nano .env
   ```

4. **Start the application**
   ```bash
   # Development mode
   npm run start:dev
   
   # Production mode
   npm run build
   npm run start:prod
   ```

## 📚 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run start` | Start the application |
| `npm run start:dev` | Start in development mode with hot reload |
| `npm run start:debug` | Start in debug mode |
| `npm run start:prod` | Start in production mode |
| `npm run build` | Build the application |
| `npm run test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:cov` | Run tests with coverage |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |

## 🛠️ Technology Stack

- **Framework**: [NestJS](https://nestjs.com/) - Progressive Node.js framework
- **Language**: [TypeScript](https://www.typescriptlang.org/) - Strict mode enabled
- **Backend Services**: [Firebase Admin SDK](https://firebase.google.com/docs/admin) - Authentication and Firestore
- **Documentation**: [Swagger/OpenAPI](https://swagger.io/) - Available at `/docs`
- **Testing**: [Jest](https://jestjs.io/) - Unit and E2E testing
- **Code Quality**: [ESLint](https://eslint.org/) + [Prettier](https://prettier.io/)

## 📁 Project Structure

### Core Layers

#### `src/config/`
Application configuration and environment validation.

#### `src/domain/`
- **Entities**: Core business objects
- **Value Objects**: Immutable objects with no identity
- **Ports**: Interfaces for external dependencies

#### `src/application/`
Business logic and use cases. This layer orchestrates domain objects.

#### `src/infrastructure/`
External services implementation (databases, APIs, file systems).

#### `src/interfaces/`
- **Controllers**: HTTP request handlers
- **DTOs**: Data Transfer Objects for validation
- **Presenters**: Response formatting

#### `src/modules/`
Feature modules that wire together domain, application, infrastructure, and interface layers.

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Application Configuration
PORT=3000
NODE_ENV=development

# Firebase Configuration
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com

# Add your other configuration variables here
```
## 📖 API Documentation

Once the application is running, visit:

- **Swagger UI**: `http://localhost:3000/docs`
- **Health Check**: `http://localhost:3000/`

## 🧪 Testing

### Unit Tests
```bash
npm run test
```

### E2E Tests
```bash
npm run test:e2e
```

### Test Coverage
```bash
npm run test:cov
```

## 🎨 Code Style

The project follows consistent code style:

- **Prettier**: Single quotes, no semicolons, trailing commas
- **ESLint**: TypeScript-specific rules
- **Conventional Commits**: For commit messages

### Format Code
```bash
npm run format
```

### Lint Code
```bash
npm run lint
```

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test additions or changes
- `chore:` Build process or auxiliary tool changes

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you have any questions or need help:

1. Check the [Issues](https://github.com/Veridion-Id/Backend-Veridion/issues) page
2. Create a new issue with detailed information
3. Contact the development team

---

**Happy Coding! 🚀**