import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Text, View, TextInput, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView } from 'react-native';
import { Button } from 'react-native-elements'
import { addUser } from '../service/myService.js';

export default class RegComponent extends Component {

    constructor(props) {
        super(props);
        this.state = {
            username: null,
            password: null,
            users: null
        }
    }

    static navigationOptions = {
        header: null
    }

    componentWillMount(){
        this.setState({users:this.props.navigation.getParam('users')})   
    }

    checkUnique(username) {
        for (let i = 0; i < this.state.users.length; i++) {
            if (username == this.state.users[i].username) {
                return false
            }
        }
        return true
    }

    respond(username, password){
        if (!this.checkUnique(username)) {
            Alert.alert(
              'Invalid username',
              'Your username has been taken',
              [
                {text: 'OK'}
              ]
            )
        } else if (username === null || password === null) {
            Alert.alert(
              'Invalid entry',
              'Your username or password cannot be empty',
              [
                {text: 'OK'}
              ]
            )
        } else {
            addUser(username, password);
            this.props.navigation.replace('Map', {
                username: username,
                password: password,
            });
        }
    }

    render() {
        return (
            <KeyboardAvoidingView style={styles.container} behavior="padding">
                {this.state.users == null && <ActivityIndicator size='large' color='#fff'/>}
                {this.state.users != null && <View>
                    <Text style={styles.titleText}>T H E O C O R P</Text>
                    <Text style={styles.subtitleText}>create an account</Text>
                    <View style={styles.loginContainer}>
                    <TextInput 
                        style={styles.input} 
                        placeholder='Username' 
                        onChangeText={(username)=>this.setState({username})} 
                        value={this.state.username}/>
                    <TextInput 
                        style={[styles.input, {marginBottom: 15}]} 
                        placeholder='Password' 
                        secureTextEntry={true}
                        onChangeText={(password)=>this.setState({password})} 
                        value={this.state.password}/>
                    <Button 
                        title='Sign up'
                        containerStyle={[styles.buttonStyle, {marginBottom: 10}]}
                        buttonStyle={{backgroundColor: '#0D91E2'}}
                        onPress={()=>this.respond(this.state.username, this.state.password)}
                    />
                    <Button 
                        title='Go Back'
                        type='outline'
                        containerStyle={styles.buttonStyle}
                        onPress={()=>this.props.navigation.navigate('Home', )}
                    />
                    </View>
                </View>}
            </KeyboardAvoidingView>
        )
    }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0D91E2',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 40,
    color: 'white',
    alignSelf: 'center'
  },
  subtitleText: {
    fontSize: 16,
    color: 'white',
    marginBottom: 20,
    alignSelf: 'center'
  },
  loginContainer: {
    backgroundColor: 'white',
    height: 250,
    width: 350,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderBottomColor: 'black',
    borderBottomWidth: 1,
    width: '70%',
    height: 45,
  },
  buttonStyle: {
    width: '70%'
  }
});
