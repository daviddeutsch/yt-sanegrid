(function () {

	angular.module('sanityData', ['youtube', 'factoryng']);


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
		}
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

						channels.get();

						channels.pageChannels()
							.then(function() {
								videos.get();

								videos.loadVideos()
									.then(function() {
										deferred.resolve(videos.countLastAdded);
									});
							});
					}, function() {
						deferred.reject();
					});

				return deferred.promise;
			}
		}
	}

	MultiAccountDataService.$inject = ['$rootScope', '$q', 'accounts', 'videos', 'channels'];
	angular.module('sanityData').service('data', MultiAccountDataService);


	function AccountService( $q, ytData, yngutils, Pouchyng )
	{
		return {
			data: new Pouchyng('accounts', 'ytSanityDB', yngutils.ASC),
			current: '',
			init: function(page) {
				var deferred = $q.defer(),
					self = this;

				if ( typeof page == 'undefined' ) {
					page = null;
				}

				ytData.channels()
					.then(function(data) {
						self.data.create({
							$id: data.items[0].id,
							title: data.items[0].snippet.title
						});

						self.current = data.items[0].id;

						deferred.resolve();
					}, function() {
						deferred.reject();
					});

				return deferred.promise;
			}
		}
	}

	AccountService.$inject = ['$q', 'ytData', 'yngutils', 'Pouchyng'];
	angular.module('sanityData').service('accounts', AccountService);


	function VideoService( $q, $rootScope, ytData, yngutils, Pouchyng, accounts, channels )
	{
		return {
			data: null,
			countLastAdded: 0,

			get: function() {
				this.data = new Pouchyng('videos', 'ytSanityDB/' + accounts.current, yngutils.ASC);
			},

			bind: function( scope ) {
				return this.data.bind(scope);
			},

			loadVideos: function() {
				var deferred = $q.defer();

				var promises = [];

				var self = this;

				this.countLastAdded = 0;

				channels.data.forEach(function(channel) {
					var promise = $q.defer();

					promises.push(promise);

					self.channelVideos(channel.channelId).then(function(){
						promise.resolve();
					}, function(){
						promise.resolve();
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
						self.pushVideos(data.items)
							.then(function() {
								deferred.resolve();
							}, function() {
								deferred.reject();
							});
					});

				return deferred.promise;
			},

			pushVideos: function ( data ) {
				var deferred = $q.defer();

				var self = this;

				if ( typeof data != 'undefined' ) {
					self.extractVideoIds(data)
						.then(function(ids){
							self.pushVideoIds(ids)
								.then(function(count){
									deferred.resolve(count);
								});
						});
				} else {
					deferred.reject();
				}

				return deferred.promise;
			},

			extractVideoIds: function ( array ) {
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

							if ( videos.exists(video.id) ) {
								promise.resolve();
							} else {
								self.pushVideo(video).then(function(){
									self.countLastAdded++;

									promise.resolve();
								});
							}
						});

						$q.all(promises).then(function(){
							deferred.resolve();
						});
					}, function() {
						deferred.resolve(0);
					});

				return deferred.promise;
			},

			pushVideo: function ( video ) {
				var deferred = $q.defer();

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

				this.data.create(details).then(function(){
					deferred.resolve();
				});

				return deferred.promise;
			}
		}
	}

	VideoService.$inject = ['$q', '$rootScope', 'ytData', 'yngutils', 'Pouchyng', 'accounts', 'channels'];
	angular.module('sanityData').service('videos', VideoService);


	function ChannelService( $q, ytData, yngutils, Pouchyng, accounts )
	{
		return {
			data: null,

			get: function() {
				this.data = new Pouchyng('channels', 'ytSanityDB/' + accounts.current, yngutils.ASC);
			},

			pageChannels: function( page )
			{
				var deferred = $q.defer();

				var self = this;

				if ( typeof page == 'undefined' ) {
					page = null;
				}

				ytData.subscriptions(page)
					.then(function(data){
						self.loadChannels(data, page)
							.then(function() {
								deferred.resolve();
							});
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
							if (
								// If we have not added all channels to the db
								(self.data.length() < data.pageInfo.totalResults)
								// and we're not at the last page of results yet
								&& (data.nextPageToken != page)
								) {
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
				var promises = [],
					self = this;

				angular.forEach(items, function(item) {
					var promise = $q.defer();

					promises.push(promise);

					if ( self.data.exists(item.id) ) {
						promise.resolve();
					} else {
						self.data.create(
							{
								$id: item.id,
								title: item.snippet.title,
								description: item.snippet.description,
								channelId: item.snippet.resourceId.channelId
							}
						).then(function(){
							promise.resolve();
						});
					}
				});

				return $q.all(promises);
			}
		}
	}

	ChannelService.$inject = ['$q', 'ytData', 'yngutils', 'Pouchyng', 'accounts'];
	angular.module('sanityData').service('channels', ChannelService);


})();
