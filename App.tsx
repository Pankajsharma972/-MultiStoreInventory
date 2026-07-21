import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { AuthProvider } from './src/features/auth/AuthProvider';
import { InventoryDataProvider } from './src/services/InventoryDataProvider';
import { RootNavigator } from './src/navigation/RootNavigator';
import { store } from './src/store';
import { colors } from './src/theme/colors';

function App() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <AuthProvider>
          <InventoryDataProvider>
            <RootNavigator />
          </InventoryDataProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </Provider>
  );
}

export default App;
