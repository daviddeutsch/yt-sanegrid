var ytsubgridApp = angular.module("ytsubgridApp",['localStorage'])

	.controller('AppCtrl', function($rootScope, appLoading) {
		$rootScope.topScope = $rootScope;
		$rootScope.$on('$routeChangeStart', function() {
			appLoading.loading();
		});
	})

	.controller('AppHomeCtrl', function($scope, appLoading) {
		appLoading.ready();
	})

	.controller('AppRepeatCtrl', function($scope, $store, ytSubList, appLoading ) {
		$scope.end = 1;

		$scope.videos = [];

		$store.bind($scope,'userid','');

		$scope.search = function(q) {
			if ( q == false ) {
				$scope.videos = [];
			} else {
				if ($scope.end < 100) {
					appLoading.loading();

					ytSubList(q, $scope.end, function(data) {
						var rewrite = [];

						var length = data.length, element = null;

						for (var i = 0; i < length; i++) {
							rewrite[i] = {
								link : data[i]['link'][0]['href'].replace( '&feature=youtube_gdata', '' ),
								title : data[i]['title']['$t'],
								img : data[i]['media$group']['media$thumbnail'][0]['url'],
								authorlink : data[i]['author'][0]['uri']['$t'],
								author : data[i]['author'][0]['name']['$t']
							};
						}

						$scope.end += 50;

						var newvideos = $scope.videos.concat(rewrite);

						if (newvideos.length <= 100) {
							$scope.videos = newvideos;
						}

						//$scope.videos = rewrite;

						appLoading.ready();
					});
				}
			}
		};

		if ( $scope.userid ) {
			$scope.search($scope.userid);
		}

	})

	.factory('appLoading', function($rootScope) {
		var timer;
		return {
			loading : function() {
				clearTimeout(timer);
				$rootScope.status = 1;
				if(!$rootScope.$$phase) $rootScope.$apply();
			},
			ready : function(delay) {
				function ready() {
					$rootScope.status = 0;
					if(!$rootScope.$$phase) $rootScope.$apply();
				}

				clearTimeout(timer);
				delay = delay == null ? 500 : false;
				if(delay) {
					timer = setTimeout(ready, delay);
				}
				else {
					ready();
				}
			}
		};
	})

	.factory('ytSubList', function($rootScope, $http, $q) {
		var searchToken = '{SEARCH}';
		var startToken = '{START}';

		var baseUrl = "https://gdata.youtube.com/feeds/api/users/" + searchToken + "/newsubscriptionvideos?alt=json&start-index=" + startToken + "&max-results=50";

		return function(q, s, fn) {
			var defer = $q.defer();
			var url = baseUrl.replace(searchToken, q).replace(startToken, s);
			$.getJSON(url).then(function(json){
				fn(json.feed.entry);
			});
		};
	})

	.directive('scroll', function($window, $document) {
		return function(scope, elem, attrs) {
			angular.element($window).bind('scroll', function() {
				if ($document.height() <= $window.innerHeight + $window.pageYOffset) {
					scope.$apply(attrs.scroll);
				}
			});
		};
	});
