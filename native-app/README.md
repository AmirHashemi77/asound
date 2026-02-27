# ASoundNative

Native iOS/React Native implementation of ASound using Expo + TypeScript.

## Run locally

```bash
npm install
npm run start
```

## iOS IPA build (EAS)

1. `npm install`
2. `npx expo prebuild`
3. `eas login`
4. `eas build -p ios --profile production`

Apple Developer account is required for signing and distributing iOS builds.
