# JDC Mobile

Application compagnon Ionic Angular pour iPhone et iPad.

## Scripts

```bash
npm install
npm start
npm run build
```

Le serveur local utilise `http://localhost:4300`.

## iOS

```bash
npm run build
npx cap add ios
npm run sync
npm run ios
```

## Notes

- Theme volontairement noir et blanc.
- Interface construite avec les composants Ionic v8 : tabs, toolbars, lists, cards, segments, modal, datetime, refresher, toast.
- L'API cible par defaut est `https://project-uxxmr.vercel.app/api`.
- Le cache Angular est desactive dans `angular.json`, car le cache natif `lmdb` provoquait un crash local du builder.
