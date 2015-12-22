angular.module('anol.savemanager')

/**
 * @ngdoc object
 * @name anol.savemanager.SaveManagerServiceProvider
 */
.provider('SaveManagerService', [function() {
    // handles layer source change events and store listener keys for removing
    // listeners nicely
    var LayerListener = function(layer, saveManager) {
        this.layer = layer;
        this.saveManager = saveManager;
        this.source = layer.olLayer.getSource();

        this.addListenerKey = undefined;
        this.changeListenerKey = undefined;
        this.removeListenerKey = undefined;
    };
    LayerListener.prototype.register = function(addHandler, changeHandler, removeHandler) {
        var self = this;

        var _register = function(type, handler, key) {
            if(handler === undefined) {
                return;
            }
            if(key !== undefined) {
                self.source.unByKey(key);
            }
            return self.source.on(
                type,
                function(evt) {
                    handler.apply(self.saveManager, [evt, self.layer]);
                }
            );
        };

        self.addListenerKey = _register(
            ol.source.VectorEventType.ADDFEATURE,
            addHandler,
            self.addListenerKey
        );
        self.changeListenerKey = _register(
            ol.source.VectorEventType.CHANGEFEATURE,
            changeHandler,
            self.changeListenerKey
        );
        self.removeListenerKey = _register(
            ol.source.VectorEventType.REMOVEFEATURE,
            removeHandler,
            self.removeListenerKey
        );
    };
    LayerListener.prototype.unregister = function() {
        var self = this;
        if(self.addListenerKey !== undefined) {
            self.source.unByKey(self.addListenerKey);
            self.addListenerKey = undefined;
        }
        if(self.changeListenerKey !== undefined) {
            self.source.unByKey(self.changeListenerKey);
            self.changeListenerKey = undefined;
        }
        if(self.removeListenerKey !== undefined) {
            self.source.unByKey(self.removeListenerKey);
            self.removeListenerKey = undefined;
        }
    };

    var _saveUrl;
    /**
     * @ngdoc method
     * @name setSaveUrl
     * @methodOf anol.savemanager.SaveManagerServiceProvider
     * @param {String} saveUrl url to save changes to. Might be overwritten by layer.saveUrl
     */
    this.setSaveUrl = function(saveUrl) {
        _saveUrl = saveUrl;
    };

    this.$get = ['$rootScope', '$q', '$http', '$timeout', function($rootScope, $q, $http, $timeout) {
        /**
         * @ngdoc service
         * @name anol.savemanager.SaveManagerService
         *
         * @description
         * Collects changes in saveable layers and send them to given saveUrl
         */
        var SaveManager = function(saveUrl) {
            this.saveUrl = saveUrl;
            this.changedLayers = {};
            this.changedFeatures = {};
        };
        /**
         * @ngdoc method
         * @name addLayer
         * @methodOd anol.savemanager.SaveManagerService
         * @param {anol.layer.Feature} layer layer to watch for changes
         */
        SaveManager.prototype.addLayer = function(layer) {
            var self = this;
            var layerListener = new LayerListener(layer, self);
            $rootScope.$watch(function() {
                return layer.loaded;
            }, function(loaded) {
                if(loaded === true) {
                    layerListener.register(
                        self.featureAddedHandler,
                        self.featureChangedHandler,
                        self.featureRemovedHandler
                    );
                } else {
                    layerListener.unregister();
                }
            });
        };
        /**
         * private function
         *
         * handler for ol3 feature added event
         */
        SaveManager.prototype.featureAddedHandler = function(evt, layer) {
            var self = this;
            self.addChangedLayer(layer);
        };
        /**
         * private function
         *
         * handler for ol3 feature changed event
         */
        SaveManager.prototype.featureChangedHandler = function(evt, layer) {
            var self = this;
            self.addChangedLayer(layer);
        };
        /**
         * private function
         *
         * handler for ol3 feature removed event
         */
        SaveManager.prototype.featureRemovedHandler = function(evt, layer) {
            var self = this;
            self.addChangedLayer(layer);
        };
        /**
         * private function
         *
         * adds a layer to list of layers with changes
         */
        SaveManager.prototype.addChangedLayer = function(layer) {
            var self = this;
            if(!(layer.name in self.changedLayers)) {
                // TODO find out why $apply already in progress
                $timeout(function() {
                    $rootScope.$apply(function() {
                        self.changedLayers[layer.name] = layer;
                    });
                });
            }
        };
        /**
         * private function
         *
         * cleans up after changes done
         */
        SaveManager.prototype.changesDone = function(layerName) {
            delete this.changedLayers[layerName];
        };
        /**
         * @ngdoc method
         * @name commit
         * @methodOd anol.savemanager.SaveManagerService
         * @param {anol.layer.Feature} layer
         * @description
         * Commits changes for given layer
         */
        SaveManager.prototype.commit = function(layer) {
            var self = this;
            var deferred = $q.defer();
            var format = new ol.format.GeoJSON();

            if(layer.name in self.changedLayers) {
                var data = {
                    name: layer.name,
                    featureCollection: format.writeFeaturesObject(
                        layer.olLayer.getSource().getFeatures()
                    )
                };
                var promise = $http.post(self.saveUrl, data);
                promise.then(function() {
                    self.changesDone(layer.name);
                    deferred.resolve();
                }, function(reason) {
                    deferred.reject(reason);
                });
            } else {
                deferred.reject('No changes for layer ' + layer.name + ' present');
            }

            return deferred.promise;
        };

        return new SaveManager(_saveUrl);
    }];
}]);