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

		$store.bind($scope,'userid','');

		$store.bind($scope,'videocache',{});

		$store.bind($scope,'idcache',{});

		$store.bind($scope,'videos',{});

		if ( $.isArray($scope.videocache) ) {
			$scope.videocache = {};
		}

		if ( $.isArray($scope.idcache) ) {
			$scope.idcache = {};
		}

		var duplicationCheck = function()
		{
			if ( $scope.idcache[$scope.userid].length == 0 || $scope.videocache[$scope.userid].length == 0 ) {
				$scope.idcache[$scope.userid] = [];
				$scope.videocache[$scope.userid] = [];

				return;
			}
			var xidcache = [];
			var xvideocache = [];

			$.each( $scope.idcache[$scope.userid], function( i, v ) {
				if ( $.inArray( v, xidcache ) == -1 ) {
					xidcache.push(v);
				}
			});

			$.each( $scope.videocache[$scope.userid], function( i, v ) {
				var found = false;

				$.each( xvideocache, function( xi, xv ) {
					if ( v.id == xv.id ) {
						found = true;
					}
				});

				if ( !found ) {
					xvideocache.push(v);
				}
			});

			$scope.idcache[$scope.userid] = xidcache;
			$scope.videocache[$scope.userid] = xvideocache;
		};

		var setUserid = function( u ) {
			if ( typeof $scope.videocache[u] == 'undefined' ) {
				$scope.videocache[u] = [];
			}

			if ( typeof $scope.idcache[u] == 'undefined' ) {
				$scope.idcache[u] = [];
			}

			$scope.userid = u;

			duplicationCheck();

			$scope.videos = $scope.videocache[$scope.userid];
		};

		var pushVideo = function( o ) {
			id = o['id']['$t'].replace( 'http://gdata.youtube.com/feeds/api/videos/', '' );

			if ( $.inArray( id, $scope.idcache[$scope.userid] ) != -1 ) {
				return false;
			}

			$scope.videocache[$scope.userid].push(
				{
					id: id,
					link : o['link'][0]['href'].replace( '&feature=youtube_gdata', '' ),
					title : o['title']['$t'],
					img : o['media$group']['media$thumbnail'][0]['url'],
					authorlink : o['author'][0]['uri']['$t'].replace('gdata.youtube.com/feeds/api/users/', 'www.youtube.com/user/'),
					author : o['author'][0]['name']['$t'],
					published : o['published']['$t'],
					muted: false
				}
			);

			$scope.idcache[$scope.userid].push(id);

			return true;
		};

		var resetErrors = function() {
			if ($scope.forbidden == 1 || $scope.notfound == 1) {
				appLoading.loading();
				$scope.forbidden = 0;
				$scope.notfound = 0;
				appLoading.ready(1);
			}
		};

		var pushVideos = function(data, code) {
			if (code == 200) {
				if (typeof data != 'undefined') {
					for (var i = 0; i < data.length; i++) {
						pushVideo(data[i]);
					}

					$scope.videos = $scope.videocache[$scope.userid];
				}
			} else if (code == 403) {
				$scope.forbidden = 1;
			} else {
				$scope.notfound = 1;
			}
		}

		var loadTop = function() {
			resetErrors();
			appLoading.loading();
			ytSubList($scope.userid, 1, pushVideos);
			appLoading.ready();
		};

		$scope.mute = function( id ) {
			$.each( $scope.videos, function( i, v ) {
				if ( v.id == id ) {
					$scope.videos[i].muted = !$scope.videos[i].muted;
				}
			});

			$scope.videocache[$scope.userid] = $scope.videos;

			return true;
		};

		$scope.loadBottom = function() {
			resetErrors();
			appLoading.loading();
			ytSubList($scope.userid, $scope.idcache[$scope.userid].length+1, pushVideos);
		};

		$scope.search = function(q) {
			if ( q == false ) {
				$scope.userid = '';
			} else {
				setUserid(q);

				loadTop();
			}
		};

		if ( $scope.userid ) {
			setUserid($scope.userid);

			loadTop();
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
			$.getJSON(url)
				.fail(function(j, t, e) {
					fn(e, j.status);
				})
				.done(function(json){
					fn(json.feed.entry, 200);
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
	})
;
