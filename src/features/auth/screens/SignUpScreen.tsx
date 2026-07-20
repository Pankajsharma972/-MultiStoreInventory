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

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export function SignUpScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);

    try {
      await signUp({ name, email, password });
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScaffold>
      <AppTextInput
        label="Full Name"
        onChangeText={setName}
        placeholder="Operator name"
        value={name}
      />
      <AppTextInput
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        label="Email"
        onChangeText={setEmail}
        placeholder="name@company.com"
        value={email}
      />
      <AppTextInput
        label="Password"
        onChangeText={setPassword}
        placeholder="Minimum 6 characters"
        secureTextEntry
        showPasswordToggle
        value={password}
      />
      <Text style={styles.note}>New signup accounts are created as staff.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <AppButton
        disabled={!name.trim() || !email.trim() || password.length < 6}
        loading={loading}
        onPress={submit}
        title="Create Account"
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
  note: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
});
