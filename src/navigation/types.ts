export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
};

export type AppStackParamList = {
  MainTabs: undefined;
  HomeTab: undefined;
  AdminDashboard: undefined;
  StaffDashboard: undefined;
  Inventory: undefined;
  NewProduct: { item?: any } | undefined;
  Stores: undefined;
  CreateStore: undefined;
  CreateWarehouse: { storeId?: string } | undefined;
  CreateLocation: { storeId?: string } | undefined;
  Transfer: undefined;
  Orders: undefined;
  BookOrder: undefined;
  Deliveries: undefined;
  History: undefined;
  LowStock: undefined;
  Users: undefined;
  CreateUser: { userId?: string } | undefined;
  Reports: undefined;
  Profile: undefined;
  Operations: undefined;
};

