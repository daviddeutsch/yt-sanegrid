(function () {

	angular.module('sanityData', ['youtube', 'factoryng']);


	function YTConnectionService( $rootScope, $q, ytData, accounts, videos, channels, archive, trash )
	{
		return {
			initAccount: function () {
				var deferred = $q.defer();

				var self = this;

				this.mainChannel()
					.then(function(id) {
						$rootScope.userid = id;

						self.pageChannels()
							.then(function() {
								self.loadVideos()
									.then(function(count) {
										deferred.resolve(count);
									});
							});
					}, function() {
						deferred.reject();
					});

				return deferred.promise;
			},

			mainChannel: function(page) {
				var deferred = $q.defer();

				if ( typeof page == 'undefined' ) {
					page = null;
				}

				ytData.channels()
					.then(function(data) {
						accounts.create({
							$id: data.items[0].id,
							title: data.items[0].snippet.title
						});

						deferred.resolve(data.items[0].id);
					}, function() {
						deferred.reject();
					});

				return deferred.promise;
			},

			bindVideos: function( scope ) {
				return videos.bind(scope);
			},

			loadVideos: function() {
				var deferred = $q.defer();

				var promises = [];

				var self = this;

				var count = 0;

				channels.forEach(function(channel) {
					var promise = $q.defer();

					promises.push(promise);

					self.channelVideos(channel.channelId).then(function(c){
						promise.resolve();

						count += c;
					}, function(){
						promise.resolve();
					});
				});

				$q.all(promises).then(function(){
					deferred.resolve(count);
				});

				return deferred.promise;
			},

			channelVideos: function( channel ) {
				var deferred = $q.defer();

				var self = this;

				ytData.channelvideos(channel)
					.then(function(data) {
						self.pushVideos(data.items)
							.then(function(count) {
								deferred.resolve(count);
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
						var promises = [],
							count = 0;

						angular.forEach(items, function(video) {
							var promise = $q.defer();

							promises.push(promise);

							if ( videos.exists(video.id) ) {
								promise.resolve();
							} else {
								self.pushVideo(video).then(function(){
									count++;
									promise.resolve();
								});
							}
						});

						$q.all(promises).then(function(){
							deferred.resolve(count);
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
					duration:    video.contentDetails.duration
				};

				var trash = false;

				// TODO: This really needs to be a deferred service
				if ( $rootScope.filters.channels.hasOwnProperty(details.channelId) ) {
					$.each( $rootScope.filters.channels[video.channelId].filters, function ( i, v ) {
						if ( video.title.indexOf( v.string) != -1 ) {
							trash = true;
						}
					});
				}

				if ( trash ) {
					$rootScope.filters.caught++;

					trash.create(details ).then(function(){
						deferred.resolve();
					});
				} else {
					videos.create(details).then(function(){
						deferred.resolve();
					});
				}

				return deferred.promise;
			},

			pageChannels: function(page)
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
				var deferred = $q.defer();

				var self = this;

				if ( typeof page == 'undefined' ) page = '';

				if ( typeof data.items != 'undefined' ) {
					self.appendChannels(data.items)
						.then(function() {
							if (
								// If we have not added all channels to the db
								(channels.length() < data.pageInfo.totalResults)
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
				var promises = [];

				angular.forEach(items, function(item) {
					var promise = $q.defer();

					promises.push(promise);

					if ( channels.exists(item.id) ) {
						promise.resolve();
					} else {
						channels.create(
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
			},

			migrateOldLS: function() {
				// Find the old userid
				// Convert old properties to new
				// - Thumbnail
				// - Duration
				// Sort into right container
			}
		}
	}

	YTConnectionService.$inject = ['$rootScope', '$q', 'ytData', 'videos', 'channels', 'archive', 'trash'];
	angular.module('sanityData').service('connection', YTConnectionService);


	function AccountService( yngutils, Pouchyng )
	{
		return new Pouchyng('accounts', 'http://127.0.0.1:5984', yngutils.ASC);
	}

	AccountService.$inject = ['yngutils', 'Pouchyng'];
	angular.module('sanityData').service('accounts', AccountService);


	function VideoService( yngutils, Pouchyng )
	{
		return new Pouchyng('videos', 'http://127.0.0.1:5984', yngutils.ASC);
	}

	VideoService.$inject = ['yngutils', 'Pouchyng'];
	angular.module('sanityData').service('videos', VideoService);


	function TrashService( yngutils, Pouchyng )
	{
		return new Pouchyng('trash', 'http://127.0.0.1:5984', yngutils.ASC);
	}

	TrashService.$inject = ['yngutils', 'Pouchyng'];
	angular.module('sanityData').service('trash', TrashService);


	function ArchiveService( yngutils, Pouchyng )
	{
		return new Pouchyng('archive', 'http://127.0.0.1:5984', yngutils.ASC);
	}

	ArchiveService.$inject = ['yngutils', 'Pouchyng'];
	angular.module('sanityData').service('archive', ArchiveService);


	function ChannelService( yngutils, Pouchyng )
	{
		return new Pouchyng('channels', 'http://127.0.0.1:5984', yngutils.ASC);
	}

	ChannelService.$inject = ['yngutils', 'Pouchyng'];
	angular.module('sanityData').service('channels', ChannelService);


})();
