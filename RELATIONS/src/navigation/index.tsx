import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {Text, View, StyleSheet} from 'react-native';
import {colors} from '../theme';

import HomeScreen from '../screens/HomeScreen';
import ContactListScreen from '../screens/ContactListScreen';
import CalendarScreen from '../screens/CalendarScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ContactDetailScreen from '../screens/ContactDetailScreen';
import AddContactScreen from '../screens/AddContactScreen';
import OnThisDayScreen from '../screens/OnThisDayScreen';

export type RootStackParamList = {
  Main: undefined;
  ContactDetail: {contactId: string};
  AddContact: undefined;
  OnThisDay: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Contacts: undefined;
  Calendar: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const TabIcon: React.FC<{label: string; focused: boolean}> = ({
  label,
  focused,
}) => {
  const icons: Record<string, string> = {
    Home: '◎',
    Contacts: '◯',
    Calendar: '▦',
    Profile: '◯',
  };

  return (
    <View style={styles.tabIconContainer}>
      <Text
        style={[
          styles.tabIcon,
          {color: focused ? colors.primary : colors.textTertiary},
        ]}>
        {icons[label] || '•'}
      </Text>
    </View>
  );
};

const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        tabBarIcon: ({focused}) => (
          <TabIcon label={route.name} focused={focused} />
        ),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        headerShown: false,
      })}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{tabBarLabel: '网络'}}
      />
      <Tab.Screen
        name="Contacts"
        component={ContactListScreen}
        options={{tabBarLabel: '联系人'}}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{tabBarLabel: '日历'}}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{tabBarLabel: '我的'}}
      />
    </Tab.Navigator>
  );
};

export const Navigation: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.surface,
          },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: {
            fontWeight: '600',
          },
          headerShadowVisible: false,
        }}>
        <Stack.Screen
          name="Main"
          component={MainTabs}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="ContactDetail"
          component={ContactDetailScreen}
          options={{
            title: '',
            headerBackTitle: '返回',
          }}
        />
        <Stack.Screen
          name="AddContact"
          component={AddContactScreen}
          options={{
            title: '添加联系人',
            headerBackTitle: '返回',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="OnThisDay"
          component={OnThisDayScreen}
          options={{
            title: '去年今日',
            headerBackTitle: '返回',
            presentation: 'modal',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: 8,
    paddingBottom: 8,
    height: 60,
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    fontSize: 24,
  },
});
