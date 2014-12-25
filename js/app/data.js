(function () {

	angular.module('sanityData', ['youtube', 'factoryng']);


	function OldAppRepeatCtrl( $rootScope, $scope, $q, $document, $state, sanityApp, ytData )
	{
		//$store.bind( $rootScope, 'userid', '' );
		//$store.bind( $rootScope, 'videocache', {} );
		//$store.bind( $rootScope, 'videos', [] );
		//$store.bind( $rootScope, 'settings', {} );
		//$store.bind( $rootScope, 'channelstate', {} );
		//$store.bind( $rootScope, 'filters', {} );

		$scope.channels = [];
		$scope.channelids = [];

		$scope.videos = [];
		$scope.videoids = [];

		$scope.archive = [];
		$scope.archiveids = [];

		$scope.trash = [];
		$scope.trashids = [];

		$rootScope.userid = '';

		var accounts = [];

		var initAccount = function () {
			$rootScope.settings.sidebar = false;

			sanityApp.loading();

			mainChannel()
				.then(function(id) {
					$rootScope.userid = id;

					syncChannels()
						.then(function() {
							loadVideos()
								.then(function(count) {
									// TODO: display count
									sanityApp.ready();
								});
						});
				}, function() {
					$state.go('ready');
				});
		};

		var mainChannel = function(page) {
			var deferred = $q.defer();

			if ( typeof page == 'undefined' ) {
				page = null;
			}

			ytData.channels()
				.then(function(data) {
					accounts.push({
						id: data.items[0].id,
						title: data.items[0].snippet.title
					});

					deferred.resolve(data.items[0].id);
				}, function() {
					deferred.reject();
				});

			return deferred.promise;
		};

		var loadVideos = function() {
			var deferred = $q.defer();

			var count = 0;

			var len = $scope.channels.length - 1;

			for ( var i = 0; i < $scope.channels.length; i++ ) {
				channelVideos($scope.channels[i].channelId)
					.then(function(entries) {
						count += entries;

						if ( i === len ) {
							deferred.resolve(count);
						}
					}(i));
			}

			return deferred.promise;
		};

		var channelVideos = function( channel ) {
			var deferred = $q.defer();

			ytData.channelvideos( channel )
				.then(function(data) {
					pushVideos(data.items)
						.then(function(count) {
							deferred.resolve(count);
						});
				});

			return deferred.promise;
		};

		var pushVideos = function ( data ) {
			var deferred = $q.defer();

			if ( typeof data != 'undefined' ) {
				extractVideoIds(data)
					.then(function(ids){
						pushVideoIds(ids)
							.then(function(count){
								deferred.resolve(count);
							});
					});
			} else {
				deferred.reject();
			}

			return deferred.promise;
		};

		var extractVideoIds = function ( array ) {
			var deferred = $q.defer();

			var list = [];

			var len = array.length - 1;

			for ( var i = 0; i < array.length; i++ ) {
				if ( typeof array[i].contentDetails == 'undefined' ) continue;

				if ( typeof array[i].contentDetails.upload != 'undefined' ) {
					list.push(array[i].contentDetails.upload.videoId);

					if ( i === len ) {
						deferred.resolve(list);
					}
				} else if ( i === len ) {
					deferred.resolve(list);
				}
			}

			return deferred.promise;
		};

		var pushVideoIds = function ( list ) {
			var deferred = $q.defer();

			ytData.videos( list )
				.then(function(data) {
					if ( typeof data.items != 'undefined' ) {
						var len = data.items.length - 1;

						var count = 0;

						for ( var i = 0; i < data.items.length; i++ ) {
							if ( pushVideo(data.items[i]) ) {
								count++;
							}

							if ( i === len ) {
								deferred.resolve(count);
							}
						}
					} else {
						deferred.resolve(0);
					}
				});

			return deferred.promise;
		};

		var pushVideo = function ( video ) {
			var details = {
				id:          video.id,
				link:        'https://www.youtube.com/watch?v=' + video.id,
				title:       video.snippet.title,
				thumbnail:   {
					default: video.snippet.thumbnails.default.url,
					medium:  video.snippet.thumbnails.medium.url,
					high:    video.snippet.thumbnails.high.url
				},
				channelId:   video.snippet.channelId,
				author:      video.snippet.channelTitle,
				authorlink:  'https://www.youtube.com/channel/' + video.snippet.channelId,
				published:   video.snippet.publishedAt,
				duration:    video.contentDetails.duration
			};

			var existing = $.inArray( video.id, $scope.videoids );

			if ( existing != -1 ) {
				// TODO: Revisit this later, might be pointless with only uploads
				// Update existing data
				/*$.each(
				 [
				 'id', 'link', 'title', 'img', 'authorid',
				 'author', 'authorlink', 'published', 'duration'
				 ],
				 function ( i, v ) {
				 $scope.videos[eid][v] = details[v];
				 }
				 );*/

				return null;
			} else {
				var trash = false;

				if ( $rootScope.filters.channels.hasOwnProperty(details.channelId) ) {
					$.each( $rootScope.filters.channels[video.channelId].filters, function ( i, v ) {
						if ( video.title.indexOf( v.string) != -1 ) {
							trash = true;
						}
					});
				}

				if ( trash ) {
					$rootScope.filters.caught++;
				}

				if ( trash ) {
					$scope.trash.push( details );
					$scope.trashids.push( details.id );
				} else {
					$scope.videos.push( details );
					$scope.videoids.push( details.id );
				}

				return true;
			}
		};

		var checkList = function() {
			var len = $scope.videos.length;

			for ( i=0; i<len; i++ ) {
				// Upgrade old style list where id was the hash
				if ( typeof $scope.videos[i].hash == 'undefined' ) {
					$scope.videos[i].hash = $scope.videos[i].id;
				}

				// Remove hashKey if it has been stored by accident
				if ( typeof $scope.videos[i].$$hashKey != 'undefined' ) {
					delete $scope.videos[i].$$hashKey;
				}

				// Lazy way to prevent dupes
				$scope.videos[i].id = i;

				// Upgrade old format where we didn't have watched and muted
				if ( typeof $scope.videos[i].watched == 'undefined' ) {
					$scope.videos[i].watched = $scope.videos[i].muted;
					$scope.videos[i].muted = false;
				}
			}
		};

		var syncChannels = function(page)
		{
			var deferred = $q.defer();

			if ( typeof page == 'undefined' ) {
				page = null;
			}

			ytData.subscriptions(page)
				.then(function(data){
					loadChannels(data, page)
						.then(function() {
							deferred.resolve();
						});
				});

			return deferred.promise;
		};

		var loadChannels = function ( data, page ) {
			var deferred = $q.defer();

			if ( typeof page == 'undefined' ) page = '';

			if ( typeof data.items != 'undefined' ) {
				appendChannels(data.items)
					.then(function() {
						if ( ($scope.channels.length < data.pageInfo.totalResults) && data.nextPageToken != page ) {
							syncChannels(data.nextPageToken)
								.then(function() {
									deferred.resolve();
								});
						} else {
							deferred.resolve();
						}
					});
			} else {
				deferred.resolve();
			}

			return deferred.promise;
		};

		var appendChannels = function ( items ) {
			var deferred = $q.defer();

			var len = items.length-1;

			for ( var i = 0; i < items.length; i++ ) {
				if ( $.inArray( items[i].id, $scope.channelids ) == -1 ) {
					$scope.channels.push(
						{
							id: items[i].id,
							title: items[i].snippet.title,
							description: items[i].snippet.description,
							channelId: items[i].snippet.resourceId.channelId
						}
					);

					$scope.channelids.push(items[i].id);
				}

				if ( i === len ) {
					deferred.resolve();
				}
			}

			return deferred.promise;
		};

		var loadTop = function () {
			sanityApp.loading();

			$rootScope.filters.caught = 0;

			loadVideos();
		};

		var updateSidebar = function () {
			if ( $rootScope.settings.sidebar === true ) {
				$('.sidebar').css({"height":$document.height()});
			} else {
				$('.sidebar').css({"height":"40px"});
			}
		};

		var migrateOldLS = function() {
			// Find the old userid
			// Convert old properties to new
			// - Thumbnail
			// - Duration
			// Sort into right container
		};

		$scope.refresh = function() {
			sanityApp.loading();

			sanityApp.update();

			loadTop();
		};

		$scope.hideChannel = function ( name ) {
			var pos = $.inArray( name, $rootScope.channeloptions.hidden );

			if ( pos != -1 ) {
				$rootScope.channeloptions.hidden = $rootScope.channeloptions.hidden.splice(pos, 1);
			} else {
				$rootScope.channeloptions.hidden.push(name);
			}
		};

		$scope.togglesidebar = function () {
			$rootScope.settings.sidebar = !$rootScope.settings.sidebar;

			updateSidebar();
		};

		$scope.videoFilter = function (video) {

			if ( $rootScope.channelstate.hidden[video.channelId] === "1" ) {
				return null;
			}

			var filtered = false;

			$.each( $rootScope.filters.global, function ( i, v ) {
				if ( video.title.indexOf( v.string ) != -1 ) {
					filtered = true;
				}
			});

			return video;
		};

		$scope.setLimit = function (increment) {
			$rootScope.settings.videolimit =
				Number($rootScope.settings.videolimit) + Number(increment)
			;

			if ( $rootScope.settings.videolimit < 1 ) {
				$rootScope.settings.videolimit = 5;
			}
		};

		var getPercentage = function () {
			if ( $rootScope.settings.videolimit < $scope.videos.length ) {
				$scope.percentage = parseInt(100 * $rootScope.settings.videolimit / $scope.videos.length);

				$scope.abslength = $rootScope.settings.videolimit;
			} else {
				$scope.percentage = 100;

				$scope.abslength = $scope.videos.length;
			}
		};

		$scope.$watch('videos', getPercentage, true);

		$scope.$watch('settings', getPercentage, true);

		$scope.percentage = getPercentage();

		angular.element($document).bind("keyup", function(event) {
			if (event.which === 82) $scope.refresh();
		});

		initAccount();

		updateSidebar();
	}

	OldAppRepeatCtrl.$inject = ['$rootScope', '$scope', '$q', '$document', '$state', 'sanityApp', 'ytData'];
	angular.module('sanityData').controller('OldAppRepeatCtrl', OldAppRepeatCtrl);


	function VideoService( yngutils, Pouchyng )
	{
		return new Pouchyng('contacts', 'http://127.0.0.1:5984', yngutils.ASC);
	}

	VideoService.$inject = ['yngutils', 'Pouchyng'];
	angular.module('sanityData').service('Video', VideoService);


})();
