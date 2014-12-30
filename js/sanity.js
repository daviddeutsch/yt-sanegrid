(function () {

	angular.module('googleAPI', []);


	function GoogleApiProvider () {
		var self = this;

		this.clientId = '950592637430.apps.googleusercontent.com';

		this.apiKey = 'AIzaSyCs378KoxX1cX5_TTa5W65tTG396AkId0A';

		this.scopes = 'https://www.googleapis.com/auth/youtube';

		this.gapi = gapi;

		this.q = {};

		this.connect = function()
		{
			var deferred = self.q.defer();

			this.gapi.auth.authorize(
				{
					client_id: this.clientId,
					scope: this.scopes,
					immediate: false
				},
				function( result ) {
					if ( result && !result.error ) {
						self.gapi.client.load('youtube', 'v3', function(response) {
							deferred.resolve(response);
						});
					} else {
						deferred.reject();
					}
				}
			);

			return deferred.promise;
		};

		this.checkAuth = function() {
			return this.connect();
		};

		this.authorize = function() {
			return this.connect();
		};

		this.load = function() {
			this.gapi.load();

			this.gapi.client.setApiKey(this.apiKey);
		};

		this.$get = [
			'$q',
			function ( $q )
			{
				var provider = new GoogleApiProvider();

				provider.q = $q;

				return provider;
			}
		];
	}

	angular.module('googleAPI').provider('googleApi', GoogleApiProvider);

})();
(function () {

	angular.module('youtube', ['googleAPI']);


	/**
	 * @name ytData
	 *
	 * @desc Querying Data from the Google YT API
	 */
	function ytDataService( $q, googleApi )
	{
		var self = this;

		this.get = function( type, options ) {
			var deferred = $q.defer();

			googleApi.gapi.client.setApiKey(googleApi.apiKey);

			if ( typeof googleApi.gapi.client.youtube !== 'undefined' ) {
				googleApi.gapi.client.youtube[type]
					.list(options)
					.execute(function(response) {
						self.convertItems(response)
							.then(function(list){
								deferred.resolve(list);
							});
					});
			} else {
				deferred.reject();
			}

			return deferred.promise;
		};

		this.convertItems = function( response ) {
			var deferred = $q.defer(),
				promises = [];

			angular.forEach(response.items, function(item, key){
				var deferred = $q.defer();

				promises.push(deferred.promise);

				response.items[key]._id = response.items[key].id;

				delete response.items[key].id;

				deferred.resolve();
			});

			$q.all(promises).then(function(){
				deferred.resolve(response);
			});

			return deferred.promise;
		};

		this.subscriptions = function( page ) {
			var options = {
				part: 'snippet',
				mine: true,
				maxResults: 50
			};

			if ( typeof page != 'undefined' ) {
				if ( page !== null ) {
					options.page = page;
				}
			}

			return self.get('subscriptions', options);
		};

		this.channels = function( page ) {
			var options = {
				part: 'snippet',
				mine: true,
				maxResults: 50
			};

			if ( typeof page != 'undefined' ) {
				if ( page !== null ) {
					options.page = page;
				}
			}

			return self.get('channels', options);
		};

		this.channelvideos = function( channel ) {
			return self.get(
				'activities',
				{
					part: 'contentDetails',
					channelId: channel,
					maxResults: 50
				}
			);
		};

		this.videos = function( ids )
		{
			var deferred = $q.defer();

			self.get(
				'videos',
				{
					part: 'snippet,contentDetails,status,statistics',
					mine: true,
					id: ids.join()
				}
			).then(function(list){
					if ( typeof list.items == 'undefined') {
						deferred.reject();
					} else {
						self.convertItems(list)
							.then(function(list){
								deferred.resolve(list.items);
							});
					}
				}, function(){
					deferred.reject();
				});

			return deferred.promise;
		};
	}

	ytDataService.$inject = ['$q', 'googleApi'];
	angular.module('youtube').service('ytData', ytDataService);



})();
(function () {

	angular.module('sanityData', ['youtube', 'pouchdb']);


	function YTConnectionService( $rootScope, $q, ytData, accounts, videos, channels, archive, trash )
	{
		return {
			migrateOldLS: function() {
				// Find the old userid
				// Convert old properties to new
				// - Thumbnail
				// - Duration
				// Sort into right container
			}
		};
	}

	YTConnectionService.$inject = ['$rootScope', '$q', 'ytData', 'accounts', 'videos', 'channels', 'archive', 'trash'];
	angular.module('sanityData').service('connection', YTConnectionService);


	function MultiAccountDataService( $rootScope, $q, accounts, videos, channels )
	{
		return {
			init: function() {
				var deferred = $q.defer();

				accounts.init()
					.then(function() {
						$rootScope.userid = accounts.current;

						deferred.resolve();
					});

				return deferred.promise;
			},
			update: function() {
				var deferred = $q.defer();

				channels.pageChannels()
					.then(function(){
						videos.loadVideos()
							.then(function() {
								videos.load()
									.then(function(){
										deferred.resolve(videos.countLastAdded);
									});
							});
					});

				return deferred.promise;
			}
		};
	}

	MultiAccountDataService.$inject = ['$rootScope', '$q', 'accounts', 'videos', 'channels'];
	angular.module('sanityData').service('data', MultiAccountDataService);


	function AccountService( $q, ytData, pouchDB )
	{
		return {
			master: pouchDB('ytSanityDB/v1'),
			data: null,
			current: '',
			init: function(page) {
				var deferred = $q.defer(),
					self = this;

				if ( typeof page == 'undefined' ) {
					page = null;
				}

				ytData.channels()
					.then(function(data) {
						self.master.get(data.items[0]._id)
							.then(function(res){

								self.createDB(res._id)
									.then(function(){
										deferred.resolve();
									});
							}, function(){
								self.master.put(data.items[0])
									.then(function(doc){
										self.current = data.items[0]._id;

										self.createDB(res._id)
											.then(function(){
												deferred.resolve();
											});
									});
							});
					}, function() {
						deferred.reject();
					});

				return deferred.promise;
			},
			createDB: function(id) {
				var deferred = $q.defer(),
					design = {
						_id: "_design/ytsanegrid",
						views: {
							'videos': {
								map: function(doc) {
									if (doc.kind === 'youtube#video') {
										emit(
											doc._id,
											{
												_id:         doc._id + '__meta',
												link:        'https://www.youtube.com/watch?v=' + doc._id,
												title:       doc.snippet.title,
												thumbnail:   {
													default: doc.snippet.thumbnails.default.url,
													medium:  doc.snippet.thumbnails.medium.url,
													high:    doc.snippet.thumbnails.high.url
												},
												channelId:   doc.snippet.channelId,
												author:      doc.snippet.channelTitle,
												authorlink:  'https://www.youtube.com/channel/' + doc.snippet.channelId,
												published:   doc.snippet.publishedAt,
												duration:    doc.contentDetails.duration
											}
										);
									}
								}.toString()
							},
							'channels': {
								map: function(doc) {
									if (doc.kind === 'youtube#subscription') {
										emit(doc._id, doc);
									}
								}.toString()
							}
						}
					},
					self = this;

				self.current = id;

				self.data = pouchDB('ytSanityDB/v1/' + id);

				self.data.get(design._id)
					.then(function(res){
						/*self.data.put(design, design._id, res._rev)
							.then(function(){
								deferred.resolve();
							});*/
						deferred.resolve();
					}, function(){
						self.data.put(design)
							.then(function(){
								deferred.resolve();
							});
					});

				return deferred.promise;
			}
		};
	}

	AccountService.$inject = ['$q', 'ytData', 'pouchDB'];
	angular.module('sanityData').service('accounts', AccountService);


	function VideoService( $q, $rootScope, ytData, pouchDB, accounts, channels )
	{
		return {
			list: [],
			countLastAdded: 0,

			load: function() {
				var deferred = $q.defer(),
					self = this;

				accounts.data.query('ytsanegrid/videos', {include_docs : true})
					.then(function(list){
						self.list = list.rows;

						$rootScope.$broadcast('videos:updated');

						deferred.resolve();
				});

				return deferred.promise;
			},

			loadVideos: function() {
				var deferred = $q.defer();

				var promises = [];

				var self = this;

				this.countLastAdded = 0;

				accounts.data.query('ytsanegrid/channels', {include_docs: true})
					.then(function(list){
						angular.forEach(list.rows, function(channel) {
							var promise = $q.defer();

							promises.push(promise);

							self.channelVideos(channel.doc.snippet.channelId).then(function(){
								promise.resolve();
							}, function(){
								promise.resolve();
							});
						});
					});

				$q.all(promises).then(function(){
					deferred.resolve();
				});

				return deferred.promise;
			},

			channelVideos: function( channel ) {
				var deferred = $q.defer();

				var self = this;

				ytData.channelvideos(channel)
					.then(function(data) {
						return self.pushVideos(data.items)
					})
					.then(function() {
						deferred.resolve();
					}, function() {
						deferred.reject();
					});

				return deferred.promise;
			},

			pushVideos: function ( data ) {
				var deferred = $q.defer();

				var self = this;

				if ( typeof data != 'undefined' ) {
					self.extractVideoIds(data)
						.then(function(ids){
							return self.pushVideoIds(ids)
						})
						.then(function(count){
							deferred.resolve(count);
						});
				} else {
					deferred.reject();
				}

				return deferred.promise;
			},

			extractVideoIds: function ( array ) {
				var deferred = $q.defer(),
					promises = [],
					list = [];

				angular.forEach(array, function(item){
					var deferred = $q.defer();

					promises.push(deferred.promise);

					if ( typeof item.contentDetails == 'undefined' ) {
						deferred.resolve();
					} else if ( typeof item.contentDetails.upload != 'undefined' ) {
						list.push(item.contentDetails.upload.videoId);

						deferred.resolve();
					} else {
						deferred.resolve();
					}
				});

				$q.all(promises).then(function(){
					deferred.resolve(list);
				});

				return deferred.promise;
			},

			pushVideoIds: function ( list ) {
				var deferred = $q.defer();

				var self = this;

				ytData.videos( list )
					.then(function(items) {
						var promises = [];

						angular.forEach(items, function(video) {
							var promise = $q.defer();

							promises.push(promise);

							accounts.data.get(video._id)
								.then(function(){
									promise.resolve();
								}, function(){
									accounts.data.put(video)
										.then(function(){
											self.countLastAdded++;

											promise.resolve();

											// TODO: Filtering -> metaData
										});
								});
						});

						$q.all(promises).then(function(){
							deferred.resolve();
						});
					}, function() {
						deferred.resolve(0);
					});

				return deferred.promise;
			}

			/*pushVideo: function ( video ) {
				var deferred = $q.defer();

				var details = {
					_id:         video.id,
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
					duration:    video.contentDetails.duration,
					archive:     false,
					trash:       false
				};

				// TODO: This really needs to be a deferred service
				if ( $rootScope.filters.channels.hasOwnProperty(details.channelId) ) {
					$.each( $rootScope.filters.channels[video.channelId].filters, function ( i, v ) {
						if ( video.title.indexOf( v.string) != -1 ) {
							details.trash = true;

							$rootScope.filters.caught++;
						}
					});
				}

				this.data.put(details).then(function(){
					deferred.resolve();
				});

				return deferred.promise;
			}*/
		};
	}

	VideoService.$inject = ['$q', '$rootScope', 'ytData', 'pouchDB', 'accounts', 'channels'];
	angular.module('sanityData').service('videos', VideoService);


	function ChannelService( $q, ytData, pouchDB, accounts )
	{
		return {
			pageChannels: function( page )
			{
				var deferred = $q.defer();

				var self = this;

				if ( typeof page == 'undefined' ) {
					page = null;
				}

				ytData.subscriptions(page)
					.then(function(data){
						return self.loadChannels(data, page)
					})
					.then(function() {
						deferred.resolve();
					});

				return deferred.promise;
			},

			loadChannels: function ( data, page ) {
				var deferred = $q.defer(),
					self = this;

				if ( typeof page == 'undefined' ) page = '';

				if ( typeof data.items != 'undefined' ) {
					self.appendChannels(data.items)
						.then(function() {
							if (data.nextPageToken != page) {
								self.pageChannels(data.nextPageToken)
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
			},

			appendChannels: function ( items ) {
				var promises = [];

				angular.forEach(items, function(item) {
					var promise = $q.defer();

					promises.push(promise);

					accounts.data.get(item._id)
						.then(function(){
							promise.resolve();
						}, function(){
							accounts.data.put(item).then(function(){
								promise.resolve();
							});
						});
				});

				return $q.all(promises);
			}
		};
	}

	ChannelService.$inject = ['$q', 'ytData', 'pouchDB', 'accounts'];
	angular.module('sanityData').service('channels', ChannelService);


})();
(function () {

	angular.module('sanityApp', [
		'ngAnimate', 'ui.router', 'mgcrea.ngStrap', 'ngSocial',
		'localStorage', 'googleAPI', 'sanityData'
	]);


	/**
	 * @name AppCfg
	 *
	 * @desc Set up the Application
	 */
	function AppCfg( $urlRouterProvider, $stateProvider )
	{
		$urlRouterProvider
			.otherwise('/ready');

		$stateProvider
			.state('ready', {
				url: '/ready',
				views: {
					"main": {
						templateUrl: 'templates/start.html'
					}
				}
			})

			.state('list', {
				url: '/list',
				views: {
					"main": {
						templateUrl: 'templates/videos.html'
					},
					"footer": {
						templateUrl: 'templates/footer.html'
					}
				}
			})
		;
	}

	AppCfg.$inject = ['$urlRouterProvider', '$stateProvider'];
	angular.module('sanityApp').config(AppCfg);


	/**
	 * @name AppRun
	 *
	 * @desc Data to prepare when we run the application
	 */
	function AppRun( $rootScope )
	{
		$rootScope.apiReady = true;

		if ( $.isEmptyObject( $rootScope.settings ) ) {
			$rootScope.settings = {
				hidewatched: false,
				hidemuted:   true,
				theme:       'default'
			};
		}

		if ( typeof $rootScope.videos == 'object' ) {
			$rootScope.videos = [];
		}

		if ( $.isEmptyObject( $rootScope.channelstate ) ) {
			$rootScope.channelstate = {};
			$rootScope.channelstate.hidden = {};
			$rootScope.channelstate.zipped = {};
		}

		if ( $.isEmptyObject( $rootScope.filters ) ) {
			$rootScope.filters = {};
			$rootScope.filters.count = 0;
			$rootScope.filters.caught = 0;
			$rootScope.filters.global = [];
		}

		if ( typeof $rootScope.filters.global == 'undefined' ) {
			$rootScope.filters = {};
			$rootScope.filters.count = 0;
			$rootScope.filters.caught = 0;
			$rootScope.filters.global = [];
			$rootScope.filters.channels = {};
		}

		if ( typeof $rootScope.filters.channels == 'undefined' ) {
			$rootScope.filters.channels = {};
		}

		if ( $.isArray( $rootScope.videocache ) ) {
			$rootScope.videocache = {};
		}

		if ( typeof $rootScope.settings.adblocksecret == 'undefined' ) {
			$rootScope.settings.adblocksecret = Math.random().toString(36).substr(2);

			$rootScope.settings.adblockoverride = false;
		}

		if ( typeof $rootScope.settings.videolimit == 'undefined' ) {
			$rootScope.settings.videolimit = 100;
		}
	}

	AppRun.$inject = ['$rootScope'];
	angular.module('sanityApp').run(AppRun);


	/**
	 * @name StartCtrl
	 *
	 * @desc Controls Behavior on the home screen
	 */
	function StartCtrl( $scope, $rootScope, $state, googleApi )
	{
		$scope.gotimelist = [
			'YEAH BOIIIII!!!',
			'Well, if you say so, I guess...',
			'My body is ready for sanity!',
			'Let\'s go!',
			'Jeez, enough with the buttons already'
		];

		var rand = Math.floor((Math.random() * $scope.gotimelist.length));

		$scope.gotime = $scope.gotimelist[rand];

		$scope.startlinelist = [
			'It\'s substantially more pleasant than a good, hard slap in the face' ,
			'It almost certainly cannot give you, like, any tangible disease',
			'Just like your extensive YouTube habit, it\'s totally not at all an unlimited source of self-loathing for its author',
			'Nobody technically forces you to use it, which is cool, I guess'
		];

		rand = Math.floor((Math.random() * $scope.startlinelist.length));

		$scope.startline = $scope.startlinelist[rand];

		$scope.connect = function()
		{
			googleApi.authorize()
				.then(function(){
					$state.go('list');
				});
		};

		if ( $rootScope.userid ) {
			$scope.start = false;

			$rootScope.settings.sidebar = false;

			googleApi.checkAuth()
				.then(function(){
					$state.go('list');
				});
		}
	}

	StartCtrl.$inject = ['$scope', '$rootScope', '$state', 'googleApi'];
	angular.module('sanityApp').controller('StartCtrl', StartCtrl);


	function AppRepeatCtrl( $rootScope, $scope, $state, $document, $timeout, $q, sanityApp, data, videos )
	{
		var initAccount = function () {
			var deferred = $q.defer();

			$rootScope.settings.sidebar = false;

			data.init()
				.then(function() {
					sanityApp.ready();

					videos.load($scope)
						.then(function(){
							$scope.videos = videos.list;

							$rootScope.$on('videos:updated', function(event, data) {
								$scope.videos = videos.list;
							});

							sanityApp.loading();

							data.update()
								.then(function(){
									deferred.resolve();
								});
						});
				}, function(){
					deferred.reject();
				});

			return deferred.promise;
		};

		var updateSidebar = function () {
			if ( $rootScope.settings.sidebar === true ) {
				$('.sidebar' ).css({"height":$document.height()});
			} else {
				$('.sidebar' ).css({"height":"40px"});
			}
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

		$scope.percentage = 0;
		$scope.abslength = 0;

		var getPercentage = function () {
			if ( $rootScope.settings.videolimit < $scope.videos.length ) {
				$scope.percentage = parseInt(100 * $rootScope.settings.videolimit / $scope.videos.length);

				$scope.abslength = $rootScope.settings.videolimit;
			} else {
				$scope.percentage = 100;

				$scope.abslength = $scope.videos.length;
			}
		};

		$timeout(function(){
			sanityApp.loading();

			initAccount()
				.then(function(){
					$scope.$watch('videos', getPercentage, true);

					$scope.$watch('settings', getPercentage, true);

					$scope.percentage = getPercentage();

					sanityApp.ready();

					updateSidebar();
				}, function(){
					$state.go('ready');
				});
		}, 50);
	}

	AppRepeatCtrl.$inject = ['$rootScope', '$scope', '$state', '$document', '$timeout' ,'$q', 'sanityApp', 'data', 'videos'];
	angular.module('sanityApp').controller('AppRepeatCtrl', AppRepeatCtrl);


	function FooterCtrl( $rootScope, $scope, $document, $state, sanityApp, data, videos )
	{
		$scope.backToStart = function ( q ) {
			$state.go('ready');
		};

		$scope.refresh = function() {
			sanityApp.loading();

			sanityApp.update();

			data.update()
				.then(function(){
					sanityApp.ready();
				});
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

		angular.element($document).bind("keyup", function(event) {
			if (event.which === 82) $scope.refresh();
		});
	}

	FooterCtrl.$inject = ['$rootScope', '$scope', '$document', '$state', 'sanityApp', 'data', 'videos'];
	angular.module('sanityApp').controller('FooterCtrl', FooterCtrl);


	function SettingsModalCtrl( $rootScope, $scope )
	{
		//$store.bind( $rootScope, 'filters', {} );

		$scope.cancel = function () {
			$scope.$hide();
		};

		$scope.redoadblocksecret = function () {
			$rootScope.settings.adblocksecret = Math.random().toString(36).substr(2);
		};

		$scope.removeFilter = function (channel, id) {
			if ( channel.length ) {
				$rootScope.filters.channels[channel].filters.splice(id,1);

				if ( $rootScope.filters.channels[channel].filters.length === 0 ) {
					delete $rootScope.filters.channels[channel];
				}
			} else {
				$rootScope.filters.global.splice(id, 1);
			}

			$rootScope.filters.count--;
		};
	}

	SettingsModalCtrl.$inject = ['$rootScope', '$scope'];
	angular.module('sanityApp').controller('SettingsModalCtrl', SettingsModalCtrl);


	function FilterModalCtrl( $rootScope, $scope )
	{
		if ( $scope.video.authorid ) {
			$scope.filter = {
				title: $scope.video.title,
				channel: $scope.video.authorid,
				author: $scope.video.author,
				authorid: $scope.video.authorid
			};
		} else {
			$scope.filter = {
				title: $scope.video.title,
				channel: $scope.video.author,
				author: $scope.video.author,
				authorid: $scope.video.author
			};
		}


		$scope.cancel = function () {
			$scope.$hide();
		};

		$scope.ok = function () {
			//$store.bind( $rootScope, 'filters', {} );

			if ( $scope.filter.channel.length ) {
				if ( typeof $rootScope.filters.channels[$scope.filter.channel] == 'undefined' ) {
					$rootScope.filters.channels[$scope.filter.channel] = {
						title: $scope.filter.channel,
						filters: []
					};
				}

				$rootScope.filters.channels[$scope.filter.channel].filters.push({string:$scope.filter.title});
			} else {
				$rootScope.filters.global.push({string:$scope.filter.title});
			}

			$rootScope.filters.count++;

			$scope.$hide();
		};
	}

	FilterModalCtrl.$inject = ['$rootScope', '$scope'];
	angular.module('sanityApp').controller('FilterModalCtrl', FilterModalCtrl);


	function SettingsTabsCtrl( $scope )
	{
		$scope.tabs = [];

		$scope.navType = 'pills';

		$scope.adblockadvice = 'firefox';

		$scope.adblockswitch = function( type ) {
			$scope.adblockadvice = type;
		};
	}

	SettingsTabsCtrl.$inject = ['$scope'];
	angular.module('sanityApp').controller('SettingsTabsCtrl', SettingsTabsCtrl);


	function SettingsAccordionCtrl( $scope )
	{
		$scope.oneAtATime = true;
	}

	SettingsAccordionCtrl.$inject = ['$scope'];
	angular.module('sanityApp').controller('SettingsAccordionCtrl', SettingsAccordionCtrl);

	/**
	 * @name sanityApp
	 *
	 * @desc Central App functionality
	 */
	function sanityAppService( $q, $rootScope )
	{
		var versionHigher = function (v1, v2) {
			var v1parts = v1.split('.');
			var v2parts = v2.split('.');

			for (var i = 0; i < v1parts.length; ++i) {
				if (v1parts[i] > v2parts[i]) return true;
			}

			return false;
		};

		var timer;

		this.resetErrors = function () {
			if ( $rootScope.forbidden == 1 || $rootScope.notfound == 1 ) {
				$rootScope.forbidden = 0;
				$rootScope.notfound = 0;
			}
		};

		this.appinfo = function ( fn ) {
			var url = "info.json";

			$.getJSON( url )
				.fail( function ( j, t, e ) {
					fn( e, j.status );
				} )
				.done( function ( json ) {
					fn( json, 200 );
				} );
		};

		this.appupdates = function ( fn ) {
			var daviddeutsch = new Gh3.User("daviddeutsch");

			var sanegrid = new Gh3.Repository("yt-sanegrid", daviddeutsch);

			sanegrid.fetch(function (err, res) {
				if(err) { fn( err, 500 ); }
			});

			sanegrid.fetchClosedIssues(function (err, res) {
				if(err) { fn( err, 500 ); }

				fn( sanegrid.getIssues(), 200 );
			});
		};

		that = this;

		this.update = function() {
			that.appinfo( function( data, code ) {
				if ( !versionHigher( data.version, $rootScope.info.version ) ) {
					return;
				}

				$rootScope.info.update = data.version;
				$rootScope.info.updates.outdated = true;
				$rootScope.info.updates.new = 0;
				$rootScope.info.updates.title = "Fresh Update(s)!";

				that.appupdates( function( list, code ) {
					$rootScope.info.updates.list = list;

					$.each( $rootScope.info.updates.list, function ( i, v ) {
						var date = new Date( v.updated_at );

						if ( date > $rootScope.info.date ) {
							$rootScope.info.updates.list[i].new = true;

							$rootScope.info.updates.new++;
						} else {
							$rootScope.info.updates.list[i].new = false;
						}
					});
				});
			});
		};

		this.appinfo( function( data, code ) {
			$rootScope.info = {
				version: data.version,
				updates: {list: []},
				date: new Date()
			};

			that.appupdates( function( list, code ) {
				$rootScope.info.updates.list = list;
			});
		});

		this.loading = function () {
			clearTimeout( timer );

			$rootScope.status = 1;
		};

		this.ready = function ( delay ) {
			function ready() {
				$rootScope.status = 0;
			}

			clearTimeout( timer );

			delay = delay === null ? 500 : false;

			if ( delay ) {
				timer = setTimeout( ready, delay );
			} else {
				ready();
			}
		};
	}

	sanityAppService.$inject = ['$q', '$rootScope'];
	angular.module('sanityApp').service('sanityApp', sanityAppService);


	/**
	 * @name timeAgoService
	 *
	 * @desc put a time distance into words
	 *
	 * From: http://jsfiddle.net/lrlopez/dFeuf/
	 */
	function timeAgoService($timeout) {
		var ref;
		return {
			nowTime: 0,
			initted: false,
			settings: {
				refreshMillis: 60000,
				allowFuture: false,
				strings: {
					prefixAgo: null,
					prefixFromNow: null,
					suffixAgo: "ago",
					suffixFromNow: "from now",
					seconds: "less than a minute",
					minute: "about a minute",
					minutes: "%d minutes",
					hour: "about an hour",
					hours: "about %d hours",
					day: "a day",
					days: "%d days",
					month: "about a month",
					months: "%d months",
					year: "about a year",
					years: "%d years",
					numbers: []
				}
			},
			doTimeout: function() {
				ref.nowTime = (new Date()).getTime();
				$timeout(ref.doTimeout, ref.settings.refreshMillis);
			},
			init: function() {
				if (this.initted === false) {
					this.initted = true;
					this.nowTime = (new Date()).getTime();
					ref = this;
					this.doTimeout();
					this.initted = true;
				}
			},
			inWords: function(distanceMillis) {
				var $l = this.settings.strings;
				var prefix = $l.prefixAgo;
				var suffix = $l.suffixAgo;
				if (this.settings.allowFuture) {
					if (distanceMillis < 0) {
						prefix = $l.prefixFromNow;
						suffix = $l.suffixFromNow;
					}
				}

				var seconds = Math.abs(distanceMillis) / 1000;
				var minutes = seconds / 60;
				var hours = minutes / 60;
				var days = hours / 24;
				var years = days / 365;

				function substitute(stringOrFunction, number) {
					var string = $.isFunction(stringOrFunction) ? stringOrFunction(number, distanceMillis) : stringOrFunction;
					var value = ($l.numbers && $l.numbers[number]) || number;
					return string.replace(/%d/i, value);
				}

				var words = seconds < 45 && substitute($l.seconds, Math.round(seconds)) ||
					seconds < 90 && substitute($l.minute, 1) ||
					minutes < 45 && substitute($l.minutes, Math.round(minutes)) ||
					minutes < 90 && substitute($l.hour, 1) ||
					hours < 24 && substitute($l.hours, Math.round(hours)) ||
					hours < 42 && substitute($l.day, 1) ||
					days < 30 && substitute($l.days, Math.round(days)) ||
					days < 45 && substitute($l.month, 1) ||
					days < 365 && substitute($l.months, Math.round(days / 30)) ||
					years < 1.5 && substitute($l.year, 1) ||
					substitute($l.years, Math.round(years));

				var separator = $l.wordSeparator === undefined ?  " " : $l.wordSeparator;
				return $.trim([prefix, words, suffix].join(separator));
			}
		};
	}

	timeAgoService.$inject = ['$timeout'];
	angular.module('sanityApp').service('timeAgo', timeAgoService);


	/**
	 * @name durationFilter
	 *
	 * @desc Turn a YT duration stamp into a parsed number
	 */
	function durationFilter()
	{
		return function ( d ) {

			var duration = d.split('M'); // PT35M2S

			duration[0] = Number(duration[0].slice(2));

			if ( typeof duration[1] == 'undefined' ) {
				duration[1] = 0;
			} else {
				duration[1] = Number(duration[1].slice(0,-1));
			}

			var h = Math.floor( duration[0] / 60 );
			var m = Math.floor( duration[0] % 60 );
			var s = duration[1];

			return (
				( h > 0 ? h + ":" : "" )
					+ ( m > 0 ? (h > 0 && m < 10 ? "0" : "" ) + m + ":" : "00:")
					+ (s < 10 ? "0" : "") + s
				);
		};
	}

	angular.module('sanityApp').filter('duration', durationFilter);


	/**
	 * @name timestampFilter
	 *
	 * @desc convert a Date() object into a timestamp string
	 */
	function timestampFilter()
	{
		return function ( d ) {
			return new Date( d ).getTime();
		};
	}

	angular.module('sanityApp').filter('timestamp', timestampFilter);


	/**
	 * @name videoItemDirective
	 *
	 * @desc Control behavior in video item
	 */
	function videoItemDirective( $timeout, videos )
	{
		return {
			restrict: 'C',
			scope: {
				video: '='
			},
			templateUrl: 'templates/item.html',
			controller: function( $scope, $rootScope ) {
				$scope.mute = function () {
					$scope.video.doc.muted = !$scope.video.doc.muted;
					$scope.video.doc.muteddate = new Date().toISOString();

					videos.data.update($scope.video);

					videos.data.put($scope.video.doc, $scope.video._id, $scope.video._rev);
				};

				$scope.watch = function( $event ) {
					if ( ($event.button == 2) ) {
						return;
					}

					$timeout(function(){$scope.watched(false);}, 400);
				};

				$scope.watched = function ( force ) {
					if ( $scope.video.doc.watched && !force ) {
						return;
					}

					$scope.video.doc.watched = !$scope.video.doc.watched;
					$scope.video.doc.watcheddate = new Date().toISOString();

					videos.data.put($scope.video.doc, $scope.video._id, $scope.video._rev);
				};

				if ( $rootScope.settings.adblockoverride ) {
					$scope.link = $scope.video.doc.link+"&adblock="+$rootScope.settings.adblocksecret;
				} else {
					$scope.link = $scope.video.doc.link;
				}

			}
		};
	}

	videoItemDirective.$inject = ['$timeout', 'videos'];
	angular.module('sanityApp').directive('videoItem', videoItemDirective);


	/**
	 * @name timeAgoDirective
	 *
	 * @desc Use the timeago service to show when something has been posted
	 */
	function timeAgoDirective( timeAgo )
	{
		return {
			replace: true,
			restrict: 'EA',
			scope: {
				"fromTime":"@"
			},
			link: {
				post: function(scope, linkElement, attrs) {
					scope.timeago = timeAgo;
					scope.timeago.init();
					scope.$watch("timeago.nowTime-fromTime",function(value) {
						if (scope.timeago.nowTime !== undefined) {
							value = scope.timeago.nowTime-scope.fromTime;
							$(linkElement).text(scope.timeago.inWords(value));
						}
					});
				}
			}
		};
	}

	timeAgoDirective.$inject = ['timeAgo'];
	angular.module('sanityApp').directive('timeAgo', timeAgoDirective);

	/**
	 * @name selectOnClickDirective
	 *
	 * @desc Select an item on being clicked
	 */
	function selectOnClickDirective() {
		return function (scope, element, attrs) {
			element.bind('click', function () {
				this.select();
			});
		};
	}

	angular.module('sanityApp').directive('selectOnClick', selectOnClickDirective);

})();

/**
 * @name googleOnLoadCallback
 *
 * @desc Bootstrap our Angular App once the google API has loaded
 */
function googleOnLoadCallback() {
	angular.bootstrap(document, ["sanityApp"]);
}
