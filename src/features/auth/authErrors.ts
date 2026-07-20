export function getAuthErrorMessage(error: unknown) {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String(error.code)
      : '';

  switch (code) {
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email or password is incorrect.';
    case 'auth/email-already-in-use':
      return 'This email is already registered. Please sign in.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/network-request-failed':
      return 'Network connection failed. Please try again.';
    case 'firestore/permission-denied':
      return 'Account created, but profile access is blocked by Firestore rules.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
