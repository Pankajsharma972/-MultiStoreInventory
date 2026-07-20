# Firebase Setup

1. Create a Firebase project.
2. Add an Android app with package name `com.multistoreinventory`.
3. Download `google-services.json`.
4. Place it at `android/app/google-services.json`.
5. Enable Email/Password in Firebase Authentication.
6. Create a Cloud Firestore database.
7. Enable Firebase Storage if product images or documents are required.

Suggested first Firestore collections:

- `users`
- `stores`
- `warehouses`
- `locations`
- `products`
- `inventory`
- `transfers`
- `orders`
- `deliveries`
- `activityLogs`
