import React from 'react';
import { ActivityIndicator, StyleSheet, View, Image } from 'react-native';

const tabIcons = {
  home: require('../assets/tab_home.png'),
  products: require('../assets/ic_box.png'),
  orders: require('../assets/tab_orders.png'),
  alerts: require('../assets/ic_alert_circle.png'),
  more: require('../assets/ic_menu.png'),
};
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../features/auth/AuthProvider';
import { ForgotPasswordScreen } from '../features/auth/screens/ForgotPasswordScreen';
import { SignInScreen } from '../features/auth/screens/SignInScreen';
import { SignUpScreen } from '../features/auth/screens/SignUpScreen';
import { AdminDashboardScreen } from '../features/dashboard/screens/AdminDashboardScreen';
import { StaffDashboardScreen } from '../features/dashboard/screens/StaffDashboardScreen';
import { AccountsDashboardScreen } from '../features/dashboard/screens/AccountsDashboardScreen';
import { SupervisorDashboardScreen } from '../features/dashboard/screens/SupervisorDashboardScreen';
import { DeliveriesScreen } from '../features/inventory/screens/DeliveriesScreen';
import { HistoryScreen } from '../features/inventory/screens/HistoryScreen';
import { LowStockAlertsScreen } from '../features/inventory/screens/LowStockAlertsScreen';
import { InventoryScreen } from '../features/inventory/screens/InventoryScreen';
import { NewProductScreen } from '../features/inventory/screens/NewProductScreen';
import { OrdersScreen } from '../features/inventory/screens/OrdersScreen';
import { BookOrderScreen } from '../features/inventory/screens/BookOrderScreen';
import { StoresScreen } from '../features/inventory/screens/StoresScreen';
import { CreateStoreScreen } from '../features/inventory/screens/CreateStoreScreen';
import { CreateWarehouseScreen } from '../features/inventory/screens/CreateWarehouseScreen';
import { CreateLocationScreen } from '../features/inventory/screens/CreateLocationScreen';
import { TransferScreen } from '../features/inventory/screens/TransferScreen';
import { UsersScreen } from '../features/inventory/screens/UsersScreen';
import { CreateUserScreen } from '../features/inventory/screens/CreateUserScreen';
import { OperationsScreen } from '../features/inventory/screens/OperationsScreen';
import { ReportsScreen } from '../features/inventory/screens/ReportsScreen';
import { ProfileScreen } from '../features/profile/screens/ProfileScreen';
import { colors } from '../theme/colors';
import type { AppStackParamList, AuthStackParamList } from './types';
import type { UserRole } from '../types/models';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();
const Tab = createBottomTabNavigator<AppStackParamList>();
const HomeStack = createNativeStackNavigator<AppStackParamList>();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    primary: colors.primary,
    card: colors.surface,
    text: colors.ink,
    border: colors.border,
  },
};

function AdminHomeStack() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
    </HomeStack.Navigator>
  );
}

function StaffHomeStack() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="StaffDashboard" component={StaffDashboardScreen} />
    </HomeStack.Navigator>
  );
}

function AccountsHomeStack() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="AccountsDashboard" component={AccountsDashboardScreen} />
    </HomeStack.Navigator>
  );
}

function SupervisorHomeStack() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="SupervisorDashboard" component={SupervisorDashboardScreen} />
    </HomeStack.Navigator>
  );
}

function homeComponentForRole(role?: UserRole) {
  if (role === 'admin') return AdminHomeStack;
  if (role === 'accounts') return AccountsHomeStack;
  if (role === 'supervisor') return SupervisorHomeStack;
  return StaffHomeStack;
}

function MainTabs({ role }: { role?: UserRole }) {
  const HomeComponent = homeComponentForRole(role);
  const showInventory = role === 'admin' || role === 'staff';
  const showOrders = role === 'admin' || role === 'staff' || role === 'accounts';
  const showAlerts = role === 'admin' || role === 'staff';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.pillText,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontFamily: 'Poppins-Medium',
          fontSize: 10,
          marginTop: -4,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 12,
          shadowColor: '#0F172A',
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -2 },
          height: 68,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarIcon: ({ focused }) => {
          let src = tabIcons.home;
          if (route.name === 'HomeTab') src = tabIcons.home;
          else if (route.name === 'Inventory') src = tabIcons.products;
          else if (route.name === 'Orders') src = tabIcons.orders;
          else if (route.name === 'LowStock') src = tabIcons.alerts;
          else if (route.name === 'Operations') src = tabIcons.more;

          return (
            <Image
              source={src}
              style={{
                width: 24,
                height: 24,
                tintColor: focused ? colors.pillText : colors.muted,
              }}
            />
          );
        },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeComponent} options={{ title: 'Home' }} />
      {showInventory ? <Tab.Screen name="Inventory" component={InventoryScreen} options={{ title: 'Products' }} /> : null}
      {showOrders ? <Tab.Screen name="Orders" component={OrdersScreen} options={{ title: 'Orders' }} /> : null}
      {showAlerts ? <Tab.Screen name="LowStock" component={LowStockAlertsScreen} options={{ title: 'Alerts' }} /> : null}
      <Tab.Screen name="Operations" component={OperationsScreen} options={{ title: 'More' }} />
    </Tab.Navigator>
  );
}

function canAccessScreen(role: UserRole | undefined, route: keyof AppStackParamList) {
  if (role === 'admin') return true;
  if (route === 'MainTabs' || route === 'Profile' || route === 'History') return true;
  if (role === 'accounts') {
    return route === 'Orders' || route === 'Deliveries' || route === 'Reports';
  }
  if (role === 'supervisor') {
    return route === 'Deliveries';
  }
  return route === 'NewProduct' || route === 'BookOrder' || route === 'Deliveries';
}

export function RootNavigator() {
  const { initializing, user, profile } = useAuth();

  if (initializing || (user && !profile)) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={theme}>
      {user ? (
        <AppStack.Navigator screenOptions={{ headerShown: false }}>
          <AppStack.Screen name="MainTabs">
            {props => <MainTabs {...props} role={profile?.role} />}
          </AppStack.Screen>
          {canAccessScreen(profile?.role, 'NewProduct') ? <AppStack.Screen name="NewProduct" component={NewProductScreen} /> : null}
          {canAccessScreen(profile?.role, 'BookOrder') ? <AppStack.Screen name="BookOrder" component={BookOrderScreen} /> : null}
          {canAccessScreen(profile?.role, 'Stores') ? <AppStack.Screen name="Stores" component={StoresScreen} /> : null}
          {canAccessScreen(profile?.role, 'CreateStore') ? <AppStack.Screen name="CreateStore" component={CreateStoreScreen} /> : null}
          {canAccessScreen(profile?.role, 'CreateWarehouse') ? <AppStack.Screen name="CreateWarehouse" component={CreateWarehouseScreen} /> : null}
          {canAccessScreen(profile?.role, 'CreateLocation') ? <AppStack.Screen name="CreateLocation" component={CreateLocationScreen} /> : null}
          {canAccessScreen(profile?.role, 'Transfer') ? <AppStack.Screen name="Transfer" component={TransferScreen} /> : null}
          {canAccessScreen(profile?.role, 'Deliveries') ? <AppStack.Screen name="Deliveries" component={DeliveriesScreen} /> : null}
          {canAccessScreen(profile?.role, 'History') ? <AppStack.Screen name="History" component={HistoryScreen} /> : null}
          {canAccessScreen(profile?.role, 'Users') ? <AppStack.Screen name="Users" component={UsersScreen} /> : null}
          {canAccessScreen(profile?.role, 'CreateUser') ? <AppStack.Screen name="CreateUser" component={CreateUserScreen} /> : null}
          {canAccessScreen(profile?.role, 'Reports') ? <AppStack.Screen name="Reports" component={ReportsScreen} /> : null}
          {canAccessScreen(profile?.role, 'Profile') ? <AppStack.Screen name="Profile" component={ProfileScreen} /> : null}
        </AppStack.Navigator>
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="SignIn" component={SignInScreen} />
          <AuthStack.Screen name="SignUp" component={SignUpScreen} />
          <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loader: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
});
