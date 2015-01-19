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

										self.createDB(data.items[0]._id)
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
				var videoView = function(doc) {
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
				};

				var deferred = $q.defer(),
					design = {
						_id: "_design/ytsanegrid",
						views: {
							'videos': {
								map: videoView.toString()
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


	function VideoService( $q, $rootScope, ytData, accounts, channels )
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

				var final_list = [];

				accounts.data.query('ytsanegrid/channels', {include_docs: true})
					.then(function(list){
						angular.forEach(list.rows, function(channel) {
							var promise = $q.defer();

							promises.push(promise);

							self.channelVideos(channel.doc.snippet.resourceId.channelId)
								.then(function(videos){
									final_list = final_list.concat(videos);

									promise.resolve();
								}, function(){
									promise.resolve();
								});
						});
					});

				$q.all(promises).then(function(){
					self.pushVideos(final_list)
						.then(function(){
							deferred.resolve();
						});
				});

				return deferred.promise;
			},

			channelVideos: function( channel ) {
				var deferred = $q.defer();

				ytData.channelvideos(channel)
					.then(function(list) {
						deferred.resolve(list);
					});

				return deferred.promise;
			},

			pushVideos: function ( data ) {
				var deferred = $q.defer();

				var self = this;

				if ( typeof data != 'undefined' ) {
					self.extractVideoIds(data)
						.then(function(ids){
							if ( ids.length ) {
								self.pushVideoIds(ids)
									.then(function(){
										deferred.resolve();
									});
							} else {
								deferred.resolve();
							}
						})

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
						accounts.data.get(item.contentDetails.upload.videoId)
							.then(function(){
								deferred.resolve();
							}, function(){
								list.push(item.contentDetails.upload.videoId);

								deferred.resolve();
							});
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

				var list = [];

				// TODO: Use bulkDocs instead of individual .put actions

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
						deferred.resolve();
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

	VideoService.$inject = ['$q', '$rootScope', 'ytData', 'accounts', 'channels'];
	angular.module('sanityData').service('videos', VideoService);


	function ChannelService( $q, ytData, accounts )
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

	ChannelService.$inject = ['$q', 'ytData', 'accounts'];
	angular.module('sanityData').service('channels', ChannelService);


})();
