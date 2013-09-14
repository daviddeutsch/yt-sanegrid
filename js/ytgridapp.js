var ytsubgridApp = angular.module( "ytsubgridApp", ['ngAnimate', 'ui.bootstrap', 'ngSocial', 'localStorage'] );

ytsubgridApp.controller( 'AppCtrl',
	['$rootScope', 'appLoading',
	function ( $rootScope, appLoading ) {
		$rootScope.topScope = $rootScope;
		$rootScope.$on( '$routeChangeStart', function () {
			appLoading.loading();
		} );
	}]
);

ytsubgridApp.controller( 'AppRepeatCtrl',
	['$scope', '$modal', '$store', '$document', 'ytSubList', 'ytChannelList', 'ytChannelVideos', 'appLoading',
	function ( $scope, $modal, $store, $document, ytSubList, ytChannelList, ytChannelVideos, appLoading ) {
		var init = function () {
			$store.bind( $scope, 'userid', '' );
			$store.bind( $scope, 'videocache', {} );
			$store.bind( $scope, 'videos', {} );
			$store.bind( $scope, 'settings', {} );
			$store.bind( $scope, 'channelstate', {} );
			$store.bind( $scope, 'filters', {} );

			$scope.start = true;

			if ( $.isEmptyObject( $scope.settings ) ) {
				$scope.settings = {
					hidewatched: false,
					hidemuted:   true,
					theme:       'default'
				}
			}

			if ( $.isEmptyObject( $scope.channelstate ) ) {
				$scope.channelstate = {};
				$scope.channelstate.hidden = {};
				$scope.channelstate.zipped = {};
			}

			if ( $.isEmptyObject( $scope.filters ) ) {
				$scope.filters = {};
				$scope.filters.global = [];
				$scope.filters.channels = {};
			}

			if ( $.isArray( $scope.videocache ) ) {
				$scope.videocache = {};
			}

			angular.element($document).bind("keyup", function(event) {
				if (event.which === 82) {
					$scope.refresh();
				}
			});
		};

		init();

		var datesort = function ( a, b ) {
			var datea = new Date( a.published );
			var dateb = new Date( b.published );

			if ( datea < dateb )
				return 1;
			if ( datea > dateb )
				return -1;
			return 0;
		};

		var checkData = function () {
			// Retrofit some parameters to existing data
			$.each( $scope.videos, function ( i, v ) {
				if ( typeof $scope.videos[i].watched == 'undefined' ) {
					$scope.videos[i].watched = $scope.videos[i].muted;
					$scope.videos[i].muted = false;
				}
			} );
		};

		var setUserid = function ( u ) {
			$scope.start = false;
			$scope.settings.sidebar = false;

			if ( typeof $scope.videocache[u] == 'undefined' ) {
				$scope.videocache[u] = [];
			}

			$scope.userid = u;

			$scope.videos = $scope.videocache[u];

			ytChannelList( $scope.userid, loadChannels );
		};

		var loadChannels = function ( data, code ) {
			if ( code == 200 ) {
				if ( typeof data != 'undefined' ) {
					$scope.channels = [];

					var idents = [];

					$.each( data, function ( i, v ) {
						if ( $.inArray( v['yt$username'], idents ) == -1 ) {
							$scope.channels.push(
								{
									id: v['yt$channelId']['$t'],
									name: v['yt$username']['$t'],
									thumbnail: v['media$thumbnail']['url']
								}
							);

							idents.push( v['yt$username'] );
						}
					} );
				}
			} else if ( code == 403 ) {
				$scope.forbidden = 1;
			} else {
				$scope.notfound = 1;
			}

			appLoading.ready();
		};

		var pushVideos = function ( data, code ) {
			if ( code == 200 ) {
				if ( typeof data != 'undefined' ) {
					for ( var i = 0; i < data.length; i++ ) {
						pushVideo( data[i] );
					}

					$scope.videos.sort( datesort );

					checkData();
				}
			} else if ( code == 403 ) {
				$scope.start = true;
				$scope.forbidden = 1;
			} else {
				$scope.start = true;
				$scope.notfound = 1;
			}

			appLoading.ready();
		};

		var pushVideo = function ( o ) {
			var id = o['id']['$t']
				.replace( 'https://gdata.youtube.com/feeds/api/videos/', '' )
				.replace( 'http://gdata.youtube.com/feeds/api/videos/', '' );

			var authid = o['author'][0]['uri']['$t']
				.replace( 'https://gdata.youtube.com/feeds/api/users/', '' );

			var details = {
				id:          id,
				link:        'https://www.youtube.com/watch?v=' + id,
				title:       o['title']['$t'],
				img:         o['media$group']['media$thumbnail'][0]['url'],
				authorid:    authid,
				author:      o['author'][0]['name']['$t'],
				authorlink:  'https://www.youtube.com/user/' + authid,
				published:   o['published']['$t'],
				duration:    o['media$group']['yt$duration']['seconds'],
				muted:       false,
				muteddate:   null,
				watched:     false,
				watcheddate: null
			};

			var existing = false;

			var eid = 0;

			$.each( $scope.videos, function ( i, v ) {
				if ( $scope.videos[i].id == id ) {
					existing = true;

					eid = i;
				}
			} );

			if ( existing ) {
				// Update existing data
				$.each(
					[
						'id', 'link', 'title', 'img', 'authorid',
						'author', 'authorlink', 'published', 'duration'
					],
					function ( i, v ) {
						$scope.videos[eid][v] = details[v];
					}
				);
			} else {
				$scope.videos.push( details );
			}

			return true;
		};

		var resetErrors = function () {
			if ( $scope.forbidden == 1 || $scope.notfound == 1 ) {
				appLoading.loading();

				$scope.forbidden = 0;
				$scope.notfound = 0;

				appLoading.ready( 1 );
			}
		};

		var loadTop = function () {
			resetErrors();

			appLoading.loading();

			//ytSubList( $scope.userid, 1, pushVideos );
		};

		var updateSidebar = function () {
			if ( $scope.settings.sidebar === true ) {
				$('.sidebar' ).css({"height":$document.height()});
			} else {
				$('.sidebar' ).css({"height":"40px"});
			}
		};

		$scope.loadBottom = function () {
			if ( $scope.start ) return;

			resetErrors();

			appLoading.loading();

			ytSubList( $scope.userid, $scope.videos.length + 1, pushVideos );
		};

		$scope.selectUserid = function ( q ) {
			if ( q == false ) {
				$scope.start = true;
			} else {
				setUserid( q );

				loadTop();
			}
		};

		$scope.refresh = function() {
			appLoading.loading();

			loadTop();
		};

		$scope.mute = function ( id ) {
			$.each( $scope.videos, function ( i, v ) {
				if ( v.id == id ) {
					$scope.videos[i].muted = !$scope.videos[i].muted;
					$scope.videos[i].muteddate = new Date().toISOString();
				}
			} );
		};

		$scope.mute = function ( id ) {
			$.each( $scope.videos, function ( i, v ) {
				if ( v.id == id ) {
					$scope.videos[i].muted = !$scope.videos[i].muted;
					$scope.videos[i].muteddate = new Date().toISOString();
				}
			} );
		};

		$scope.hideChannel = function ( name ) {
			var pos = $.inArray( name, $scope.channeloptions.hidden );

			if ( pos != -1 ) {
				$scope.channeloptions.hidden = $scope.channeloptions.hidden.splice(pos, 1);
			} else {
				$scope.channeloptions.hidden.push(name);
			}
		};

		$scope.watch = function ( id, $event ) {
			if ( ($event.button == 2) ) {
				return;
			}

			$scope.watched(id, false);
		};

		$scope.watched = function ( id, force ) {
			for( i=0; i<$scope.videos.length; i++ ) {
				if ( $scope.videos[i].id == id ) {
					if ( $scope.videos[i].watched && !force ) {
						return;
					}

					$scope.videos[i].watched = !$scope.videos[i].watched;
					$scope.videos[i].watcheddate = new Date().toISOString();
				}
			}
		};

		$scope.togglesidebar = function () {
			$scope.settings.sidebar = !$scope.settings.sidebar;

			updateSidebar();
		};

		$scope.videolist = function () {
			var ids = [];
			var result = [];

			var len = $scope.videos.length;

			for( i=0; i<len; i++ ) {
				var video = $scope.videos[i];

				if ( $.inArray( video.id, ids ) != -1  ) {
					$scope.videos.splice(i, 1);

					result[i] = null;
					continue;
				}

				if (
					( ( video.muted && ($scope.settings.hidemuted == "1") )
						|| ( video.watched && ($scope.settings.hidewatched == "1") ) )
					) {
					continue;
				}

				var auth = video.authorlink.split("/");
				var key = auth[auth.length-1].toLowerCase();

				if ( $scope.channelstate.hidden[key] === "1" ) {
					continue;
				}

				var filtered = false;

				$.each( $scope.filters.global, function ( i, v ) {
					if ( video.title.indexOf( v.string ) != -1 ) {
						filtered = true;
					}
				});

				if ( !filtered && $scope.filters.channels.hasOwnProperty(video.authorid) ) {
					$.each( $scope.filters.channels[video.authorid].filters, function ( i, v ) {
						if ( video.title.indexOf( v.string) != -1 ) {
							filtered = true;
						}
					});
				}

				if ( filtered ) {
					$scope.videos[i].muted = true;

					continue;
				}

				ids.push(video.id);

				result[i] = video;
			}

			return result;
		};

		if ( $scope.userid ) {
			$scope.start = false;
			$scope.settings.sidebar = false;

			setUserid( $scope.userid );

			loadTop();

			updateSidebar();
		}
	}]
);

ytsubgridApp.controller( 'SettingsModalCtrl',
	[ '$scope', '$store', '$modal',
		function ($scope, $store, $modal) {
			$store.bind( $scope, 'filters', {} );

			$scope.open = function () {
				var modalInstance = $modal.open({
					templateUrl: 'templates/settings.html',
					backdrop: false,
					dialogFade:true,
					controller: SettingsModalInstanceCtrl,
					scope: $scope
				});
			};
		}]
);

var SettingsModalInstanceCtrl = function ($scope, $modalInstance, $store) {
	$store.bind( $scope, 'filters', {} );

	$scope.cancel = function () {
		$modalInstance.dismiss('cancel');
	};

	$scope.removeFilter = function (channel, id) {
		if ( channel.length ) {
			$scope.filters.channels[channel].filters.splice(id,1)
		} else {
			$scope.filters.global.splice(id,1)
		}

	};
};

ytsubgridApp.controller( 'SupportModalCtrl',
	[ '$scope', '$modal',
	function ($scope, $modal) {
		$scope.open = function () {
			var modalInstance = $modal.open({
				templateUrl: 'templates/support.html',
				backdrop: false,
				dialogFade:true,
				controller: SupportModalInstanceCtrl
			});
		};
	}]
);

var SupportModalInstanceCtrl = function ($scope, $modalInstance) {
	$scope.cancel = function () {
		$modalInstance.dismiss('cancel');
	};
};

ytsubgridApp.controller( 'FilterModalCtrl',
	[ '$scope', '$store', '$modal',
		function ($scope, $store, $modal) {
			$store.bind( $scope, 'filters', {} );

			$scope.open = function (video) {
				$scope.video = video;

				var modalInstance = $modal.open({
					templateUrl: 'templates/filter.html',
					backdrop: false,
					dialogFade:true,
					controller: FilterModalInstanceCtrl,
					resolve: {
						item: function () {
							return $scope.video;
						},
						filters: function() {
							return $scope.filters;
						}
					}
				});
			};
		}]
);

var FilterModalInstanceCtrl = function ($scope, $modalInstance, item, filters) {
	$scope.filter = {
		title: item.title,
		channel: item.authorid,
		author: item.author,
		authorid: item.authorid
	};

	$scope.cancel = function () {
		$modalInstance.dismiss('cancel');
	};

	$scope.ok = function () {
		if ( $scope.filter.channel.length ) {
			if ( typeof filters.channels[$scope.filter.channel] == 'undefined' ) {
				filters.channels[$scope.filter.channel] = {
					title: $scope.filter.channel,
					filters: []
				};
			}

			filters.channels[$scope.filter.channel].filters.push({string:$scope.filter.title});
		} else {
			filters.global.push({string:$scope.filter.title});
		}

		$modalInstance.dismiss('ok');
	};

};

ytsubgridApp.factory( 'appLoading',
	['$rootScope',
	function ( $rootScope ) {
		var timer;
		return {
			loading: function () {
				clearTimeout( timer );

				$rootScope.status = 1;

				if ( !$rootScope.$$phase ) $rootScope.$apply();
			},
			ready:   function ( delay ) {
				function ready() {
					$rootScope.status = 0;

					if ( !$rootScope.$$phase ) $rootScope.$apply();
				}

				clearTimeout( timer );

				delay = delay == null ? 500 : false;

				jQuery( "abbr.timeago" ).timeago();

				if ( delay ) {
					timer = setTimeout( ready, delay );
				} else {
					ready();
				}
			}
		};
	}]
);

ytsubgridApp.factory( 'ytSubList',
	['$q',
	function ( $q ) {
		var searchToken = '{SEARCH}';

		var startToken = '{START}';

		var baseUrl = "https://gdata.youtube.com/feeds/api/users/"
			+ searchToken
			+ "/newsubscriptionvideos?alt=json&start-index="
			+ startToken
			+ "&max-results=50";

		return function ( q, s, fn ) {
			var defer = $q.defer();

			var url = baseUrl.replace( searchToken, q ).replace( startToken, s );

			$.getJSON( url )
				.fail( function ( j, t, e ) {
					fn( e, j.status );
				} )
				.done( function ( json ) {
					fn( json.feed.entry, 200 );
				} )
			;
		};
	}]
);

ytsubgridApp.factory( 'ytChannelList',
	['$q',
	function ( $q ) {
		var searchToken = '{SEARCH}';

		var baseUrl = "https://gdata.youtube.com/feeds/api/users/"
			+ searchToken
			+ "/subscriptions?alt=json"
			+ "&max-results=50";

		return function ( q, fn ) {
			var defer = $q.defer();

			var url = baseUrl.replace( searchToken, q );

			$.getJSON( url )
				.fail( function ( j, t, e ) {
					fn( e, j.status );
				} )
				.done( function ( json ) {
					fn( json.feed.entry, 200 );
				} )
			;
		};
	}]
);

ytsubgridApp.factory( 'ytChannelVideos',
	['$q',
	function ( $q ) {
		var searchToken = '{SEARCH}';

		var baseUrl = "https://gdata.youtube.com/feeds/api/users/"
			+ searchToken
			+ "/uploads?alt=json";

		return function ( q, fn ) {
			var defer = $q.defer();

			var url = baseUrl.replace( searchToken, q );

			$.getJSON( url )
				.fail( function ( j, t, e ) {
					fn( e, j.status );
				} )
				.done( function ( json ) {
					fn( json.feed.entry, 200 );
				} )
			;
		};
	}]
);

ytsubgridApp.directive( 'scroll',
	['$window', '$document',
	function ( $window, $document ) {
		return function ( scope, elem, attrs ) {
			angular.element( $window ).bind( 'scroll', function () {
				if ( $document.height() <= $window.innerHeight + $window.pageYOffset ) {
					scope.$apply( attrs.scroll );
				}
			} );
		};
	}]
);

ytsubgridApp.filter( 'duration',
	function () {
		return function ( d ) {
			d = Number( d );

			var h = Math.floor( d / 3600 );
			var m = Math.floor( d % 3600 / 60 );
			var s = Math.floor( d % 3600 % 60 );

			return (
				( h > 0 ? h + ":" : "" )
					+ ( m > 0 ? (h > 0 && m < 10 ? "0" : "" ) + m + ":" : "00:")
					+ (s < 10 ? "0" : "") + s
				);
		};
	}
);
