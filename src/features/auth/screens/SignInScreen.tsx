import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../../../components/AppButton';
import { AppTextInput } from '../../../components/AppTextInput';
import { colors } from '../../../theme/colors';
import type { AuthStackParamList } from '../../../navigation/types';
import { useAuth } from '../AuthProvider';
import { getAuthErrorMessage } from '../authErrors';
import { AuthScaffold } from '../components/AuthScaffold';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export function SignInScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
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
      <AppTextInput
        label="Password"
        onChangeText={setPassword}
        placeholder="Enter password"
        secureTextEntry
        showPasswordToggle
        value={password}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <AppButton
        disabled={!email.trim() || !password}
        loading={loading}
        onPress={submit}
        title="Sign In"
      />
      <View style={styles.links}>
        {/* <AppButton
          onPress={() => navigation.navigate('ForgotPassword')}
          title="Forgot password"
          variant="ghost"
        /> */}
        <AppButton
          onPress={() => navigation.navigate('SignUp')}
          title="Create staff account"
          variant="ghost"
        />
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  error: {
    color: colors.danger,
    fontSize: 14,
    marginBottom: 12,
  },
  links: {
    marginTop: 10,
  },
});
