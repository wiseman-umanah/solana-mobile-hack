# OTC - Private Liquidity Network

A mobile OTC (Over-The-Counter) trading platform built on Solana for private, secure token buys and liquidity transactions.

## 🚀 Features

- **Private OTC Trading**: Execute large token trades privately without public slippage
- **Escrow Security**: All trades secured by smart contract escrow
- **Real-time Messaging**: Integrated chat for negotiation and communication
- **Multi-token Support**: Trade any SPL tokens on Solana
- **Wallet Integration**: Connect your Solana wallet securely
- **Mobile-first**: Native iOS and Android experience

## 📱 Download

### Android
```
Download APK from releases or Google Play Store
```

### Development Build
```bash
# Clone the repository
git clone https://github.com/wiseman-umanah/solana-mobile-hack.git

# Install dependencies
npm install

# Run on Android
npx expo run:android

```

## ⚙️ Setup

### Prerequisites
- Node.js 18+
- Expo CLI
- Android Studio (for Android development)

### Environment Variables
Create a `.env` file in the root directory:

```env
EXPO_PUBLIC_BACKEND_URL=https://your-backend-api.com
EXPO_PUBLIC_ESCROW_PROGRAM_ID=36w......2xnGN5EWV
EXPO_PUBLIC_ESCROW_QUOTE_MINT=4zMM....JDncDU
EXPO_PUBLIC_ESCROW_FEE_TREASURY=J1XL....voheeg3

```

### Installation
```bash
# Install dependencies
npm install

# Start development server
npx expo start

# Run on device
npx expo run:android  # or expo run:ios
```

## 🏗️ Project Structure

```
mobile/
├── app/                 # Expo Router pages
│   ├── (otc)/          # Main app tabs
│   │   ├── dashboard/   # Main dashboard
│   │   ├── create/      # Create listings
│   │   ├── listing/     # Browse listings
│   │   ├── message/     # Messaging
│   │   └── profile/     # User profile
│   └── index.tsx       # Onboarding
├── components/          # Reusable components
├── constants/           # App constants
├── contexts/           # React contexts
├── lib/                # Utilities and helpers
└── assets/             # Images and assets
```

## 🔧 Technology Stack

- **Frontend**: React Native with Expo
- **Navigation**: Expo Router
- **Styling**: NativeWind (Tailwind CSS)
- **State Management**: React Context
- **Blockchain**: Solana Web3.js
- **Backend**: Node.js with Socket.io
- **Authentication**: JWT-based auth

## 📋 Screens

- **Onboarding**: Introduction to OTC trading
- **Dashboard**: Portfolio overview and quick actions
- **Create Listing**: List tokens for OTC trade
- **Browse Listings**: Discover and filter available trades
- **Messages**: Real-time chat with trading partners
- **Profile**: Account settings and trading history

## 🔐 Security

- All trades secured by Solana smart contracts
- End-to-end encryption for messages
- Secure wallet integration
- Backend authentication with JWT tokens

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: Report bugs via GitHub Issues
- **Email**: wisemanumanah@gmail.com

---

**Built with ❤️ for the Solana ecosystem**