import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { ScrollView, TouchableOpacity, StyleSheet, Text, View, Animated, PanResponder, ActivityIndicator, Image, Dimensions, Alert } from 'react-native';
import { SearchBar } from 'react-native-elements'
import Permissions from 'react-native-permissions'
import MapView from 'react-native-maps'
import { decode, addRoute, trimAddr } from '../service/myService.js';
import { db } from '../db.js';

let routesRef = db.ref('/routes');

export default class GeoComponent extends Component {

    constructor() {
        super();
        this.state = {
            locationPermission: 'unknown',
            position: 'unknown',
            region: {},
            search: '',
            isLoaded: false,
            busStops: null,
            busStopSelected: true,
            searchSelected: false,
            busInfo: [],
            polyline: null,
            destination: null,
            destCoords: null,
            travelTime: null,
            instructions: [],
            userRoutes:[]
        }
        this.getCurrentLocation = this.getCurrentLocation.bind(this)
    }

    static navigationOptions = {
        header: null
    }

    componentWillMount() {
        this.animatedValue = new Animated.ValueXY();
        this._value = {x: 0, y: 0}
        this.animatedValue.addListener((value) => this._value = value);
        this.panResponder = PanResponder.create({
            onStartShouldSetPanResponder: (evt, gestureState) => true,
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                return !(gestureState.dx < 30 && gestureState.dy < 30)                  
            },
            onPanResponderGrant: (e, gestureState) => {
                this.animatedValue.setOffset({
                    x: this._value.x,
                    y: this._value.y,
                })
                this.animatedValue.setValue({ x: 0, y: 0})
            },
            onPanResponderMove: Animated.event([
                null, { dx: 0, dy: this.animatedValue.y}
            ]),
        })
    }

    async componentDidMount() {
        this.getCurrentLocation();
        await this.getSavedRoutes();
    }

    async loadRoute(route) {
        if (this.getDestCoord(route.end)) {
            await this.getRoute(route.start,route.end)
        }
    }

    async getSavedRoutes(){
        routesRef.on('value',async (snapshot)=>{
          let data = snapshot.val();
          let allRoutes = Object.values(data);
          userRoutes = []
          for (let i = 0; i < allRoutes.length; i++) {
            if (allRoutes[i].username == this.props.navigation.getParam('username','')) {
                userRoutes.push(allRoutes[i])
            }
          }
          this.setState({userRoutes});
        })
    }

    async findAddress(lat,lng) {
        let googleApi = `https://maps.googleapis.com/maps/api/geocode/json?`+
                        `latlng=${lat},${lng}&`+
                        `key=AIzaSyA2uBawhhpsC-QhPxkCcPeEeEKV5nKLSns`
        return await fetch(googleApi)
        .then((response)=>response.json())
        .then((response)=>{return response.results[0].formatted_address})
    }

    async saveRoute(){
        let startAddr = await this.findAddress(this.state.region.latitude,this.state.region.longitude)
        let route = {
            start: startAddr,
            end:this.state.destination,
            time:this.state.travelTime
        }
        for (let i = 0; i < this.state.userRoutes.length; i++){
            if (this.state.userRoutes[i].route.end == route.end) {
                Alert.alert(
                  'Duplicate route',
                  'This route has already been saved',
                  [
                    {text: 'OK'}
                  ]
                );
                return
            }
        }
        Alert.alert(
          'Success',
          'Route has been saved successfully',
          [
            {text: 'OK'}
          ]
        );
        addRoute(this.props.navigation.getParam('username',''),route);
    }

    parseBusInfo(busStopNo,busStopName,busInfo) {
        let buses = []
        for (let i = 0; i < busInfo.length; i++) {
            let busObj = {
                routeNo: parseInt(busInfo[i].RouteNo,10),
                leaveTime: busInfo[i].Schedules[0].ExpectedLeaveTime,
                destination: busInfo[i].Schedules[0].Destination,
                countdown: busInfo[i].Schedules[0].ExpectedCountdown,
                stopNo: busStopNo,
                stopName: busStopName
            }
            buses.push(busObj)
        }
        return buses
    }

    filterSkytrain(allStops){
        let busStops = []
        for (let i = 0; i < allStops.length; i++){
            if (allStops[i].OnStreet != 'SKYTRAIN') {
                busStops.push(allStops[i])
            }
        }
        return busStops
    }

    async getDestCoord(address){
        let googleApi = "https://maps.googleapis.com/maps/api/geocode/json?address="
        let accessKey = `&key=AIzaSyA2uBawhhpsC-QhPxkCcPeEeEKV5nKLSns`
        let encodedAddr = encodeURIComponent(address)
        let encodedUrl = googleApi + encodedAddr + accessKey
        await fetch(encodedUrl)
        .then((response) => response.json())
        .then((response) => {if (response.status != 'OK') {
                              Alert.alert(
                                  'Invalid location',
                                  'The location entered cannot be found',
                                  [
                                    {text: 'OK'}
                                  ]
                                );
                                return false
                            } else {
                                this.setState({
                                    destCoords:{
                                        latitude: response.results[0].geometry.location.lat,
                                        longitude: response.results[0].geometry.location.lng
                                    },
                                    destination: response.results[0].formatted_address
                                })
                                return true
                            }})
        .catch((error) => {console.log(error)})
    }

    async getRoute(origin,destination) {
        let encodedDest = encodeURIComponent(destination)
        let apiUrl = `https://maps.googleapis.com/maps/api/directions/json?` +
                     `origin=${origin}`+
                     `&destination=${encodedDest}`+
                     `&mode=transit&units=metric&transit_mode=bus&key=AIzaSyA2uBawhhpsC-QhPxkCcPeEeEKV5nKLSns`
        await fetch(apiUrl)
        .then((response) => response.json())
        .then((response) => {
            if (response.status != 'OK') {
                this.setState({searchSelected:false,polyline:null})
                Alert.alert(
                  'Cannot find route',
                  'Google cannot find a route to the location',
                  [
                    {text: 'OK'}
                  ]
                );
                return
            }
            let polyline = decode(response.routes[0].overview_polyline.points)
            let steps = response.routes[0].legs[0].steps
            let instructions = []
            for (let i = 0; i < steps.length; i++){
                instructions.push(steps[i].html_instructions)
            }
            this.setState({searchSelected: true})
            this.setState({instructions});
            this.setState({polyline});
            this.setState({travelTime:response.routes[0].legs[0].duration.text})
        })
        .catch((error) => console.log(error))
    }

    async getEstimates() {
        let max = this.state.busStops.length > 3 ? 3 : this.state.busStops.length
        let buses = []
        for (let i = 0; i < max; i++) {
            let apiUrl = `https://api.translink.ca/rttiapi/v1/stops/${this.state.busStops[i].StopNo}/estimates?apikey=ZFUEBho1ZLmYupfhbjeN&count=1&timeframe=30`
            await fetch(apiUrl, {
              headers:{
                'content-type': 'application/JSON'
              }
            })
            .then((response) => response.json())
            .then((response) => this.parseBusInfo(
                this.state.busStops[i].StopNo,
                this.state.busStops[i].Name,
                response
            ))
            .then((result) => {buses = buses.concat(result)})   
            .catch((error)=> console.log(error))
        }
        this.setState({busInfo:buses})
    }

    async getStops() {
        let apiUrl = `https://api.translink.ca/rttiapi/v1/stops?apikey=ZFUEBho1ZLmYupfhbjeN&`+
            `lat=${Math.round(this.state.region.latitude * 1000000) / 1000000}&`+
            `long=${Math.round(this.state.region.longitude * 1000000) / 1000000}&`+
            `radius=200`
        await fetch(apiUrl, {
          headers:{
            'content-type': 'application/JSON'
          }
        })
        .then((response) => response.json())
        .then((response) => this.setState({busStops:this.filterSkytrain(response)}))
        .catch((error)=> console.log(error))
    }

    getCurrentLocation() {
        navigator.geolocation.getCurrentPosition(async (position) => {
            this.setState({
                region: {
                    latitude: position.coords.latitude,
                    latitudeDelta: 0.006,
                    longitude: position.coords.longitude,
                    longitudeDelta: 0.006,
                }
            })
            await this.getStops();
            await this.getEstimates();
            this.setState({isLoaded:true})
        }, (error) => {console.log(error)})
    }

    render() {
        const animatedStyle = {
            transform: this.animatedValue.getTranslateTransform()
        }
        let busStopIcon = require('../assets/bus_marker.png');

        let textTabBus = this.state.busStopSelected ? {opacity: 1} : {opacity: 0.5}
        let lineTabBus = this.state.busStopSelected ? {backgroundColor: '#fff'} : {backgroundColor: '#0D91E2'}
        let textTabFav = this.state.busStopSelected ? {opacity: 0.5} : {opacity: 1}
        let lineTabFav = this.state.busStopSelected ? {backgroundColor: '#0D91E2'} : {backgroundColor: '#fff'}

        let infoTop = SCREEN_HEIGHT-170

        setTimeout(()=>this.getEstimates(), 60000);

        return (
            <View style={styles.map}>
            <Image source={busStopIcon} style={{height:0,width:0}} />
            {this.state.isLoaded ? 
            <View style={styles.map}>
                <MapView
                initialRegion={this.state.region}
                style={styles.map}
                >
                <MapView.Marker
                      coordinate={{
                        latitude: this.state.region.latitude,
                        longitude: this.state.region.longitude
                      }}
                      title="Your location" />
                {this.state.busStops.map(marker => (
                    <MapView.Marker
                      key={marker.StopNo}
                      coordinate={{
                        latitude: marker.Latitude,
                        longitude: marker.Longitude  
                      }}
                      title={`StopNo ${marker.StopNo}`}
                      description={`${marker.Name}`}
                      image={busStopIcon} />
                ))}
                {this.state.polyline != null && 
                    <MapView.Polyline coordinates={this.state.polyline} 
                    strokeWidth={5} 
                    strokeColor='#0D91E2'/>}
                {this.state.polyline != null &&
                    <MapView.Marker
                      coordinate={{
                        latitude: this.state.destCoords.latitude,
                        longitude: this.state.destCoords.longitude
                      }}
                      title={this.state.destination}
                      pinColor='blue' />}
                </MapView>
                <SearchBar 
                    round={true}
                    containerStyle={styles.searchContainer}
                    inputContainerStyle={styles.inputContainer}
                    inputStyle={styles.searchText}
                    searchIcon={{size: 24}}
                    placeholder='Where to?'
                    onChangeText={(search)=>this.setState({search})}
                    value={this.state.search}
                    onSubmitEditing={async ()=>{
                        let dest = this.state.search.trim();
                        if (this.getDestCoord(dest)) {
                            await this.getRoute(`${this.state.region.latitude},${this.state.region.longitude}`,dest)
                        }
                    }}
                />
                {this.state.searchSelected ? 
                <View style={styles.resultsContainer}>
                    <View style={styles.titleContainer}>
                        <Text style={styles.titleText}>{this.state.search}</Text>
                    </View>
                    <View style={styles.favContainer}>
                        <TouchableOpacity style={styles.favButton} onPress={()=>this.saveRoute()}>
                            <Text style={styles.favText}>+</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.closeContainer}>
                        <TouchableOpacity style={[styles.favButton, {paddingBottom: 10}]} onPress={()=>this.setState({searchSelected: false, polyline: null})}>
                            <Text style={styles.favText}>x</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.instContainer}>
                        <View style={styles.estimateContainer}>
                            <Text style={{fontSize: 24, fontWeight: 'bold'}}>Current Travel Time</Text>
                            <Text style={{fontSize: 18}}>{this.state.travelTime}</Text>
                        </View>
                        {this.state.instructions != '' && 
                        <ScrollView style={{alignSelf: 'flex-start', paddingLeft: 20, width: '100%', marginTop: 30}}>
                            {this.state.instructions.map(instruction => (
                                <View key={instruction} style={{height: 60, alignItems: 'center', flexDirection: 'row'}}>
                                <View style={{height: 62, width: 5, backgroundColor: '#0D91E2', alignItems: 'center', justifyContent: 'center', marginLeft: 9}}>
                                    <View style={{height: 20, width: 20, backgroundColor: '#fff', borderRadius: 10, borderColor: '#0D91E2', borderWidth: 3}}>
                                    </View>
                                </View>
                                <Text style={{marginLeft: 20, fontSize: 24}}>{instruction}</Text>
                                </View>
                            ))}
                        </ScrollView>}
                    </View>
                </View> :
                <Animated.View style={[styles.infoBar, animatedStyle, {top: infoTop}]} {...this.panResponder.panHandlers}>
                    <View style={styles.infoTabs}>
                        <View style={styles.line}></View>
                        <View style={styles.tabContainer}>
                            <TouchableOpacity style={styles.tab} onPress={()=>this.setState({busStopSelected: true})}>
                                <Text style={[styles.tabText, textTabBus]}>Bus Stop</Text>
                                <View style={[styles.tabLine, lineTabBus]}></View>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.tab} onPress={()=>this.setState({busStopSelected: false})}>
                                <Text style={[styles.tabText, textTabFav]}>Favorites</Text>
                                <View style={[styles.tabLine, lineTabFav]}></View>
                            </TouchableOpacity>
                        </View>
                    </View>
                    {this.state.busStopSelected ? 
                    <View>
                    {this.state.busInfo.map(bus => (
                    <View key={`${bus.stopNo.toString() + bus.routeNo.toString()}`} style={styles.infoDisplay}>
                        <View style={styles.leftContainer}>
                            <Text style={styles.busNum}>{bus.routeNo}</Text>
                        </View>
                        <View style={styles.destContainer}>
                            <Text style={styles.busDest}>{`to ${bus.destination}`}</Text>
                            <Text style={{fontSize: 16, color: '#777'}}>{bus.stopName}</Text>
                        </View>
                        <View style={styles.nextContainer}>
                            <Text style={styles.busNext}>Leaves in</Text>
                            <Text style={[styles.busNext, {color: '#777'}]}>{`${bus.countdown} mins`}</Text>
                        </View>
                    </View>
                    ))}
                    </View> : 
                    <View>
                    {this.state.userRoutes.map(routeInfo => (
                        <TouchableOpacity key={routeInfo.id} style={styles.infoDisplay}
                        onPress={()=>this.loadRoute(routeInfo.route)}>
                            <View style={styles.destContainer}>
                                <Text style={styles.busDest}>{`FROM ${trimAddr(routeInfo.route.start)}`}</Text>
                                <Text style={styles.busDest}>{`TO ${trimAddr(routeInfo.route.end)}`}</Text>
                            </View>
                            <View style={styles.nextContainer}>
                                <Text style={styles.busNext}>TRAVEL TIME</Text>
                                <Text style={[styles.busNext, {color: '#777'}]}>{routeInfo.route.time}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                    </View>}
                </Animated.View>}
            </View>
            : <ActivityIndicator size='large' color='#0D91E2'/>}
            </View>
        )
    }
}

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
  },
  searchContainer: {
    position: 'absolute',
    top: '5%',
    alignSelf: 'center',
    width: '90%',
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    borderTopWidth: 0,
  },
  inputContainer: {
    backgroundColor: '#fff',
    height: 45,
  },
  searchText: {
    color: '#000',
    fontSize: 20,
  },
  resultsContainer: {
    width: '100%',
    position: 'absolute',
    bottom: 0
  },
  titleContainer: {
    position: 'absolute',
    top: -80,
    left: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    color: '#0D91E2',
    fontSize: 36,
    fontWeight: 'bold',
  },
  favContainer: {
    height: 50,
    position: 'absolute',
    top: -80,
    right: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeContainer: {
    height: 50,
    position: 'absolute',
    top: -80,
    right: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instContainer: {
    backgroundColor: '#f9f9f9',
    height: 250,    
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 15,
  },
  estimateContainer: { 
    justifyContent: 'center',
    paddingLeft: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    width: '95%',
    position: 'absolute',
    top: -25,
    left: '2.5%',
    zIndex: 2,
    height: 70,
  },
  infoBar: {
    position: 'absolute',
    width: '100%',
    flexDirection: 'column',
    borderRadius: 10,
  },
  infoTabs: {
    backgroundColor: '#0D91E2',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 80,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  line: {
    backgroundColor: '#fff',
    height: 5,
    width: 50,
    borderRadius: 2,
    marginTop: 7,
  },
  tabContainer: {
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15
  },
  tabText: {
    color: '#fff',
    fontSize: 18
  },
  tabLine: {
    backgroundColor: '#fff',
    height: 3,
    width: 100,
    borderRadius: 2,
    marginTop: 7,
  },
  infoDisplay: {
    backgroundColor: '#fff',
    height: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favButton: {
    height: 50,
    width: 50,
    borderRadius: 25,
    backgroundColor: '#0D91E2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 2
  },
  favText: {
    color: '#fff',
    fontSize: 36,
  },
  leftContainer: {
    width: '20%',
    height: 50,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 10
  },
  destContainer: {
    width: '55%',
    height: 50,
    justifyContent: 'center',
  },
  nextContainer: {
    width: '25%',
    height: 50,
    justifyContent: 'center',
  },
  busNum: {
    fontSize: 38,
    height: 50
  },
  busDest: {
    fontSize: 16,
  },
  busNext: {
    fontSize: 16,
  },
});

const {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
} = Dimensions.get('window');