import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../../../components/AppButton';
import { AppTextInput } from '../../../components/AppTextInput';
import type { AuthStackParamList } from '../../../navigation/types';
import { colors } from '../../../theme/colors';
import { useAuth } from '../AuthProvider';
import { getAuthErrorMessage } from '../authErrors';
import { AuthScaffold } from '../components/AuthScaffold';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setMessage('');
    setLoading(true);

    try {
      await resetPassword(email);
      setMessage('Password reset email sent.');
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScaffold>
      <AppTextInput
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        label="Email"
        onChangeText={setEmail}
        placeholder="name@company.com"
        value={email}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <AppButton
        disabled={!email.trim()}
        loading={loading}
        onPress={submit}
        title="Send Reset Link"
      />
      <AppButton
        onPress={() => navigation.goBack()}
        title="Back to sign in"
        variant="ghost"
      />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  error: {
    color: colors.danger,
    fontSize: 14,
    marginBottom: 12,
  },
  message: {
    color: colors.success,
    fontSize: 14,
    marginBottom: 12,
  },
});
