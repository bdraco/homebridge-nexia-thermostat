var Service, Characteristic;
var rp = require('request-promise')
require('request-promise').debug = true;

module.exports = function(homebridge){
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-nexia-thermostat", "NexiaThermostat", NexiaThermostat);
};


function NexiaThermostat(log, config) {
	this.log = log;
  this.name = config.name;
  this.apiroute = config.apiroute;
  this.houseId = config.houseId;
  this.thermostatIndex = config.thermostatIndex;
  this.xMobileId = config.xMobileId;
	this.xApiKey = config.xApiKey;
  this.manufacturer = config.manufacturer;
  this.model = config.model;
  this.serialNumber = config.serialNumber;
	this.service = new Service.Thermostat(this.name);
  this.TStatData = {};
  this._currentData = {};
}

NexiaThermostat.prototype = {
	//Start
	identify: function(callback) {
		this.log("Identify requested!");
		callback(null);
	},
	// Required
	getCurrentHeatingCoolingState: function(callback) {
		this.log("getCurrentHeatingCoolingState");
    if (!this._currentData) { 
       callback("getCurrentHeatingCoolingState: data not yet loaded");
    }
    var thisTStat = this._findTStatInNexiaResponse();
    var characteristic = this._findCurrentState(thisTStat);
    return callback(null, characteristic);
	},
  getTargetHeatingCoolingState: function(callback) {
		this.log("getTargetHeatingCoolingState");
    if (!this._currentData) { 
       callback("getCurrentHeatingCoolingState: data not yet loaded");
    }
    var thisTStat = this._findTStatInNexiaResponse();
    var characteristic = this._findTargetState(thisTStat);
    return callback(null, characteristic);
	},
  setTargetHeatingCoolingState: function(value, callback) {
		this.log("setTargetHeatingCoolingState");
	  if (!this._currentData) { 
       callback("setTargetHeatingCoolingState: data not yet loaded");
    }
    var thisTStat = this._findTStatInNexiaResponse();
    return this._setHVACMode(thisTStat, value, callback);
	},
	getCurrentTemperature: function(callback) {
		this.log("getCurrentTemperature");
		if (!this._currentData) { 
       callback("getCurrentHeatingCoolingState: data not yet loaded");
    }
    var thisTStat = this._findTStatInNexiaResponse();
    var f = this._findCurrentTemp(thisTStat);
    var c = (f-32.0) / 1.8;
    callback(null, c);
	},
	getTargetTemperature: function(callback) {
		this.log("getTargetTemperature");
    if (!this._currentData) { 
      callback("getCurrentHeatingCoolingState: data not yet loaded");
    }
    var thisTStat = this._findTStatInNexiaResponse();
    var f = this._findCurrentSetPoint(thisTStat);
    var c = (f-32.0) / 1.8;
    callback(null, c);
	},
  setTargetTemperature: function(value, callback) {
		this.log("setTargetTemperature");
    if (!this._currentData) { 
       callback("setTargetTemperature: data not yet loaded");
    }
    var thisTStat = this._findTStatInNexiaResponse();
    return this._setTemp(thisTStat, value, callback);
  },
	getTemperatureDisplayUnits: function(callback) {
		this.log("getTemperatureDisplayUnits");
		var error = null;
    callback(null, Characteristic.TemperatureDisplayUnits.FAHRENHEIT);
	},
	setTemperatureDisplayUnits: function(value, callback) {
		this.log("setTemperatureDisplayUnits");
		callback(null);
	},
  getName: function(callback) {
		this.log("getName :", this.name);
		if (!this._currentData) { 
       callback("getName: data not yet loaded");
    }
    var thisTStat = this._findTStatInNexiaResponse();
    this.name = thisTStat.name;
		callback(error, this.name);
	},

	getServices: function() {

		// you can OPTIONALLY create an information service if you wish to override
		// the default values for things like serial number, model, etc.
		var informationService = new Service.AccessoryInformation();

		informationService
			.setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
			.setCharacteristic(Characteristic.Model, this.model)
			.setCharacteristic(Characteristic.SerialNumber, this.serialNumber);


		// Required Characteristics
		this.service
			.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
			.on('get', this.getCurrentHeatingCoolingState.bind(this));

		this.service
			.getCharacteristic(Characteristic.TargetHeatingCoolingState)
			.on('get', this.getTargetHeatingCoolingState.bind(this))
			.on('set', this.setTargetHeatingCoolingState.bind(this));

		this.service
			.getCharacteristic(Characteristic.CurrentTemperature)
			.on('get', this.getCurrentTemperature.bind(this));

		this.service
			.getCharacteristic(Characteristic.TargetTemperature)
			.on('get', this.getTargetTemperature.bind(this))
			.on('set', this.setTargetTemperature.bind(this));

		this.service
			.getCharacteristic(Characteristic.TemperatureDisplayUnits)
			.on('get', this.getTemperatureDisplayUnits.bind(this))
			.on('set', this.setTemperatureDisplayUnits.bind(this));

		this.service
			.getCharacteristic(Characteristic.Name)
			.on('get', this.getName.bind(this));

    this._refreshData();

    setInterval(this._refreshData.bind(this), 30 * 1000);

		return [informationService, this.service];
	},

  _refreshData: function() {
    var that = this;
		this._get("houses/" + this.houseId)
      .then(function (body) {
        that.log("Refreshed Data!");
        var parse = JSON.parse(body);
        if(parse.error) {
          that.log("There was an error fetching data: " + parse.error);
          return;
        } 
        that._currentData = parse;

        that._updateData().bind(that);

        /* TODO */

/*
 *
 *
 *
 * service
 *       .getCharacteristic(Characteristic.TargetTemperature)
 *             .setProps({
 *                     minValue: minTemperature,
 *                             maxValue: maxTemperature,
 *                                     minStep: 1
 *                                           });
 *
 *                                               service
 *                                                     .getCharacteristic(Characteristic.CurrentTemperature)
 *                                                           .setProps({
 *                                                                   minValue: minTemperature,
 *                                                                           maxValue: maxTemperature,
 *                                                                                   minStep: 1
 *                                                                                         });
 *
 *
 *
 *
 *
 *
 *
 *
 */

        return;
      }).catch(function(err) {
        that.log("Error from get: " + err);
     });
  },
  _get: function(url) {
    return rp({
      uri: this._calculateUrl(url),
      headers: {'X-MobileId':  this.xMobileId, 'X-ApiKey': this.xApiKey}
    }) 
  },
  _post: function(url, body) {
    return rp({
      method: 'POST',
      uri: this._calculateUrl(url),
      headers: {'X-MobileId':  this.xMobileId, 'X-ApiKey': this.xApiKey},
      body: body,
      json: true
    }) 
  },
  _put: function(url, body) {
    return rp({
      method: 'PUT',
      uri: this._calculateUrl(url),
      headers: {'X-MobileId':  this.xMobileId, 'X-ApiKey': this.xApiKey},
      body: body,
      json: true
    }) 
  },

  _calculateUrl: function(url) {
    this.log("_calculateUrl in: " + url);

    var newurl = ( url.indexOf('http://') == 0 || url.indexOf('https://') == 0  ) ? url : (this.apiroute + url);
    this.log("_calculateUrl out: " + newurl);

    return newurl;
  },
  _setTemp: function(thisTStat, value, callback) {
      var that = this;
      var f = value * 1.8 + 32.0;
      // should search settings for hvac_mode and not just
      // assume settings[0]

      var key_name = Object.keys(thisTStat.features[0].actions)[0]
      var url = thisTStat.features[0].actions[key_name].href;
      var targetState = this._findTargetState(thisTStat);
      var json_struct;
      switch (targetState) {
        case Characteristic.TargetHeatingCoolingState.AUTO:
          json_struct = {"heat":f+2,"cool":f-2};
        case Characteristic.TargetHeatingCoolingState.HEAT:
          json_struct = {"heat":f};
        default:
          json_struct = {"cool":f};
      }

      this.log("JSON:" + json_struct); 
      return this._put(url,json_struct)
        .then(function (body) {
          callback(null,value);
          that.log("Set State!");
          that.log(body);
          //that._refreshData() -- LOOPS!
        }).catch(function(err) {
          that.log("Error from _put to :" + url +  ":  " + err);
        });
    },


    _setHVACMode: function(thisTStat, value, callback) {
      var that = this;
      // should search settings for hvac_mode and not just
      // assume settings[0]

      var url = thisTStat.settings[0]._links.self.href;
      var txt_value = this.ConfigKeyForheatingCoolingState(value);
      var json_struct = {"value":txt_value};
      this.log("JSON:" + json_struct); 
      return this._post(url,json_struct)
        .then(function (body) {
          callback(null,value);
          that.log("Set State!");
          that.log(body);
          //that._refreshData() -- LOOPS!
        }).catch(function(err) {
          that.log("Error from _post to :" + url +  ":  " + err);
        });
    },


  _findTStatInNexiaResponse: function() {
      var data = this._currentData;

      var all_items = data.result._links.child[0].data.items;
      var want_tStatId = this.thermostatIndex;
      var tStatId = -1;

      for(var index = 0; index < all_items.length; index++ ) {
        if (all_items[index].type.indexOf('thermostat') > -1) {
           tStatId++;  
           if (tStatId === want_tStatId) {
              console.log(all_items[index]);
              return all_items[index];
           } 
        }
      }

      throw new Error("The tStatId is missing");
  },

  _findTargetState: function(thisTStat) {
    var rawState = "unknown";
    if (thisTStat.hasOwnProperty("zones")) {
      rawState = thisTStat.zones[0].current_zone_mode;
    } else if (thisTStat.hasOwnProperty("settings")) {
      // should search settings for hvac_mode and not just
      // assume settings[0]
      rawState = thisTStat.settings[0].current_value;
    } else {
      this.log("no state");
    }
    return this.TargetHeatingCoolingStateForConfigKey(rawState);
  },

  _findCurrentState: function(thisTStat) {
    var rawState = "unknown";
    if (thisTStat.hasOwnProperty("zones")) {
      rawState = thisTStat.zones[0].current_zone_mode;
    } else if (thisTStat.hasOwnProperty("features")) {
      // should search settings for hvac_mode and not just
      // assume settings[0]
      rawState = thisTStat.features[0].status;
      this.log("_findCurrentState:" + rawState);
    } else {
      this.log("no state");
    }
    return this.CurrentHeatingCoolingStateForConfigKey(rawState);
  },

  _findCurrentSetPoint: function(thisTStat) {
    var target_state = this._findTargetState; 
    if (thisTStat.hasOwnProperty("zones")) {
        var zone_zero = thisTStat.zones[0];
        if(target_state === Characteristic.TargetHeatingCoolingState.COOL) {
           return zone_zero.setpoints.cool;
        }
        else if(target_state === Characteristic.TargetHeatingCoolingState.HEAT) {
           return zone_zero.setpoints.heat;
        }
        return zone_zero.temperature;
    } else if (thisTStat.hasOwnProperty("features")) {
        var features_node = thisTStat.features[0];
        if(target_state === Characteristic.TargetHeatingCoolingState.COOL && features_node.hasOwnProperty("setpoint_cool")) {
           return features_node.setpoint_cool;
        }
        else if(target_state === Characteristic.TargetHeatingCoolingState.HEAT && features_node.hasOwnProperty("setpoint_heat")) {
           return features_node.setpoint_heat;
        }
        else if(features_node.hasOwnProperty("setpoint_cool")) {
           return features_node.setpoint_cool;
        }
        else if(features_node.hasOwnProperty("setpoint_heat")) {
          return features_node.setpoint_heat;
        }
    }
    
    this.log("no current setpoint");
    return 0; /* should error */
  },

  _findCurrentTemp: function(thisTStat) {
    if (thisTStat.hasOwnProperty("zones")) {
      return thisTStat.zones[0].temperature;
    } else if (thisTStat.hasOwnProperty("features")) {
      return thisTStat.features[0].temperature;
    }
    
    this.log("no state");
    return 0; /* should error */
  },

_updateData: function() {
  this.service.getCharacteristic(Characteristic.CurrentTemperature).getValue();
  this.service.getCharacteristic(Characteristic.TargetTemperature).getValue();
  this.service.getCharacteristic(Characteristic.CurrentHeatingCoolingState).getValue();
  this.service.getCharacteristic(Characteristic.TargetHeatingCoolingState).getValue();
  return 1;
},

  ConfigKeyForheatingCoolingState: function(state) {
    switch (state) {
      case Characteristic.TargetHeatingCoolingState.AUTO:
        return "heat-cool";
      case Characteristic.TargetHeatingCoolingState.COOL:
        return "cool";
      case Characteristic.TargetHeatingCoolingState.HEAT:
        return "heat";
      default:
        return "off";
    }
  },
  TargetHeatingCoolingStateForConfigKey: function(configKey) {
    switch (configKey.toLowerCase()) {
      case 'auto':
        return Characteristic.TargetHeatingCoolingState.AUTO;
      case 'cool':
        return Characteristic.TargetHeatingCoolingState.COOL;
      case 'heat':
        return Characteristic.TargetHeatingCoolingState.HEAT;
      default:
        return Characteristic.TargetHeatingCoolingState.OFF;
    }
  },

  CurrentHeatingCoolingStateForConfigKey: function(configKey) {
    switch (configKey.toLowerCase()) {
      case 'auto':
        return Characteristic.CurrentHeatingCoolingState.AUTO;
      case 'cool':
        return Characteristic.CurrentHeatingCoolingState.COOL;
      case 'heat':
        return Characteristic.CurrentHeatingCoolingState.HEAT;
      default:
        return Characteristic.CurrentHeatingCoolingState.OFF;
    }
  }
};
