import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createStackNavigator, createAppContainer } from 'react-navigation';

import GeoComponent from './component/GeoComponent';
import HomeComponent from './component/HomeComponent';
import RegComponent from './component/RegComponent';

const RootStack = createStackNavigator(
  {
    Home: HomeComponent,
    Map: GeoComponent,
    Reg: RegComponent
  },
  {
    initialRouteName: 'Home',
  }
)

const AppContainer = createAppContainer(RootStack)

console.disableYellowBox = true;

export default class App extends React.Component {
  render() {
    return (
      <AppContainer />
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
