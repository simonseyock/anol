angular.module('anol.geocoder')
/**
 * @ngdoc directive
 * @name anol.geocoder.directive:anolGeocoderSearchbox
 *
 * @restrict A
 * @required $timeout
 * @requires anol.map.MapService
 * @requires anol.map.ControlsService
 *
 * @param {string} anolGeocoderSearchbox Name of geocoder to use. Must be an available anol.geocoder
 * @param {string} zoomLevel Level to show result in
 * @param {object} geocoderOptions Options for selected geocoder
 * @param {string} proxyUrl Proxy to use
 * @param {number} highlight Time result marker is visible. Use 0 for invinitiv visibility (removeable by click)
 * @param {string} templateUrl Url to template to use instead of default one
 *
 * @description
 * Search for a location string on given geocoder, display and select results
 */
.directive('anolGeocoderSearchbox', ['$timeout', 'MapService', 'ControlsService', 'InteractionsService', 'LayersService',
  function($timeout, MapService, ControlsService, InteractionsService, LayersService) {
    return {
      restrict: 'A',
      require: '?^anolMap',
      transclude: true,
      templateUrl: function(tElement, tAttrs) {
          var defaultUrl = 'src/modules/geocoder/templates/searchbox.html';
          return tAttrs.templateUrl || defaultUrl;
      },
      scope: {
        geocoder: '@anolGeocoderSearchbox',
        zoomLevel: '@',
        geocoderOptions: '=',
        proxyUrl: '@',
        highlight: '@',
        markerStyle: '=?'
      },
      link: function(scope, element, attrs, AnolMapController) {
        var removeMarkerInteraction;
        var geocoderOptions = angular.copy(scope.geocoderOptions);
        var markerLayer = new anol.layer.Feature({
          style: scope.markerStyle
        });
        var markerOlLayerOptions = markerLayer.olLayerOptions;
        markerOlLayerOptions.source = new markerLayer.OL_SOURCE_CLASS(markerLayer.olSourceOptions);
        markerLayer.setOlLayer(new markerLayer.OL_LAYER_CLASS(markerOlLayerOptions));

        LayersService.addSystemLayer(markerLayer);

        if(angular.isDefined(scope.proxyUrl)) {
          if(scope.proxyUrl[scope.proxyUrl.length - 1] !== '/') {
            scope.proxyUrl += '/';
          }
          geocoderOptions.url = scope.proxyUrl + geocoderOptions.url;
        }

        var geocoder = new anol.geocoder[scope.geocoder](geocoderOptions);
        scope.searchResults = [];
        scope.noResults = false;
        scope.searchInProgress = false;
        scope.highlight = angular.isDefined(scope.highlight) ? parseInt(scope.highlight) : false;

        var changeCursorCondition = function(pixel) {
            return MapService.getMap().hasFeatureAtPixel(pixel, function(layer) {
                return markerLayer === layer.get('anolLayer');
            });
        };

        var addMarker = function(position) {
          var markerFeature = new ol.Feature({
            geometry: new ol.geom.Point(position)
          });
          var markerSource = markerLayer.olLayer.getSource();
          markerSource.addFeature(markerFeature);
          if(scope.highlight > 0) {
            $timeout(function() {
              markerSource.clear();
            }, scope.highlight);
          } else {
            removeMarkerInteraction = new ol.interaction.Select({
              layers: [markerLayer.olLayer]
            });
            removeMarkerInteraction.on('select', function(evt) {
              if(evt.selected.length > 0) {
                removeMarkerInteraction.getFeatures().clear();
                markerSource.clear();
                InteractionsService.removeInteraction(removeMarkerInteraction);
                MapService.removeCursorPointerCondition(changeCursorCondition);
                removeMarkerInteraction = undefined;
              }
            });
            InteractionsService.addInteraction(removeMarkerInteraction);
            MapService.addCursorPointerCondition(changeCursorCondition);
          }
        };

        scope.startSearch = function() {
          scope.searchResults = [];
          scope.noResults = false;
          scope.searchInProgress = true;

          markerLayer.olLayer.getSource().clear();

          element.find('.anol-searchbox').removeClass('open');
          geocoder.request(scope.searchString)
            .then(function(results) {
              scope.searchInProgress = false;
              if(results.length === 0) {
                scope.noResults = true;
              } else {
                scope.searchResults = results;
                element.find('.anol-searchbox').addClass('open');
              }
              scope.$digest();
            });
        };

        scope.handleInputKeypress = function(event) {
          event.stopPropagation();
          if((event.key === 'ArrowDown' || event.keyCode === 40) && scope.searchResults.length > 0) {
            event.preventDefault();
            element.find('.dropdown-menu li a:first').focus();
          }
          if(event.key === 'Enter' || event.keyCode === 13) {
            event.preventDefault();
            scope.startSearch();
          }
          return false;
        };

        scope.handleDropdownKeypress = function(event) {
          event.stopPropagation();
          var targetParent = angular.element(event.currentTarget).parent();
          if(event.key === 'ArrowDown' || event.keyCode === 40) {
            event.preventDefault();
            targetParent.next().find('a').focus();
          }
          if(event.key === 'ArrowUp' || event.keyCode === 38) {
            event.preventDefault();
            var target = targetParent.prev().find('a');
            if(target.length === 0) {
              element.find('.form-control').focus();
            } else {
              target.focus();
            }
          }
          return false;
        };

        scope.handleMouseover = function(event) {
          angular.element(event.currentTarget).focus();
        };

        scope.showResult = function(result) {
          var view = MapService.getMap().getView();
          var position = ol.proj.transform(
            result.coordinate,
            result.projectionCode,
            view.getProjection()
          );
          view.setCenter(position);
          if(angular.isDefined(scope.zoomLevel)) {
            view.setZoom(parseInt(scope.zoomLevel));
          }
          if(scope.highlight !== false) {
            addMarker(position);
          }
          scope.searchResults = [];
          element.find('.anol-searchbox').removeClass('open');
        };

        if(angular.isObject(AnolMapController)) {
           ControlsService.addControl(new anol.control.Control({
            element: element
          }));
        }
      }
    };
}]);