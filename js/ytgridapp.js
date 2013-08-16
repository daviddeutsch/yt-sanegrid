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

		if ( typeof $scope.videos == 'undefined' ) {
			$scope.videos = [];
		}

		if ( typeof $scope.idlist == 'undefined' ) {
			$scope.idlist = [];
		}

		var pushVideos = function( o ) {
			id = o['id']['$t'].replace( 'http://gdata.youtube.com/feeds/api/videos/', '' );

			if ($.inArray( $scope.idlist, id ) > 0 ) {
				return false;
			}

			$scope.videos.push(
				{
					id: id,
					link : o['link'][0]['href'].replace( '&feature=youtube_gdata', '' ),
					title : o['title']['$t'],
					img : o['media$group']['media$thumbnail'][0]['url'],
					authorlink : o['author'][0]['uri']['$t'].replace('gdata.youtube.com/feeds/api/users/', 'www.youtube.com/user/'),
					author : o['author'][0]['name']['$t'],
					published : o['published']['$t']
				}
			);

			$scope.idlist.push(id);

			return true;
		};

		var loadTop = function() {
			appLoading.loading();

			ytSubList($scope.userid, 1, function(data) {
				for (var i = 0; i < data.length; i++) {
					pushVideos(data[i]);
				}

				appLoading.ready();
			});
		};

		$scope.loadBottom = function() {
			appLoading.loading();

			ytSubList($scope.userid, $scope.idlist.length+1, function(data) {
				for (var i = 0; i < data.length; i++) {
					pushVideos(data[i]);
				}

				appLoading.ready();
			});
		};

		$scope.search = function(q) {
			if ( q == false ) {
				$scope.userid = '';
				$scope.videos = [];
			} else {

				if ( $scope.userid != q ) {
					$scope.userid = q;
				}

				loadTop();
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
	})
;
