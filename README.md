# Store Inventory with Sales Tracking System
A system that can help small business owners track their stocks and sales with a very user-friendly interface and great ux design.

## Features

- **Inventory Management**: Track products, stock levels, and categories
- **Sales Reports**: Visualize sales data with interactive charts
- **Contact Management**: Manage customers and suppliers
- **Offline Support**: Full offline functionality with data sync
- **Progressive Web App**: Install and use like a native app
- **Modern UI/UX**: Beautiful and responsive design

## Tech Stack

- **Frontend**: Vue 3 + Quasar Framework
- **State Management**: Pinia
- **Database**: Firebase
- **Offline Storage**: Dexie (IndexedDB)
- **Charts**: Chart.js
- **Build Tool**: Vite

## Prerequisites

- Node.js >= 16.x
- npm >= 6.13.4 or yarn >= 1.21.1
- Firebase account and project

## Installation

1. Clone the repository:
```bash
git clone [your-repo-url]
cd StoreInventorywithSalesTrackingSystem
```

2. Install dependencies:
```bash
yarn
# or
npm install
```

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Fill in your Firebase configuration

## Development

Start the app in development mode (hot-code reloading, error reporting, etc.):
```bash
quasar dev
```

### Build for Production

```bash
# Build for production
quasar build

# Build PWA
quasar build -m pwa
```

## Project Structure

```
src/
├── assets/         # Static assets
├── components/     # Reusable Vue components
├── pages/         # Main view components
├── stores/        # Pinia stores
├── services/      # Business logic
├── firebase/      # Firebase config
├── db/           # Database (Dexie)
└── utils/        # Utility functions
```

## Key Components

### Inventory Management
- Product CRUD operations
- Stock level tracking
- Category management
- Barcode scanning support

### Reporting System
- Sales analytics
- Inventory reports
- Chart visualizations
- Export functionality

### Contact Management
- Customer database
- Supplier management
- Contact history

## PWA Features

- Offline functionality
- Push notifications
- App-like experience
- Automatic updates

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, email [your-email] or open an issue in the repository.
